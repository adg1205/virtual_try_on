const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { STORES } = require('../utils/storeData');

const locatorSource = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'js', 'nearby-stores.js'),
    'utf8'
);

// Lift the real shipped helpers rather than restating them, so these tests fail
// if the turn-by-turn rendering in the page changes.
function loadHelpers() {
    const grab = (name) => {
        const match = locatorSource.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n    }`));
        assert.ok(match, `nearby-stores.js should define ${name}`);
        return match[0];
    };
    return new Function(
        grab('escapeHtml') + grab('maneuverIcon') + grab('formatManeuverText') +
        '; return { maneuverIcon, formatManeuverText };'
    )();
}

// OSRM reports the manoeuvre kind in `type` and the direction in `modifier`.
// A left turn is {type: 'turn', modifier: 'left'} — the direction never appears
// in `type`, which is what made every turn render the same arrow.
test('turn arrows follow the OSRM modifier, not the type', () => {
    const { maneuverIcon } = loadHelpers();

    assert.equal(maneuverIcon({ type: 'turn', modifier: 'left' }), '⬅️');
    assert.equal(maneuverIcon({ type: 'turn', modifier: 'slight left' }), '⬅️');
    assert.equal(maneuverIcon({ type: 'turn', modifier: 'sharp left' }), '⬅️');
    assert.equal(maneuverIcon({ type: 'turn', modifier: 'right' }), '➡️');
    assert.equal(maneuverIcon({ type: 'turn', modifier: 'slight right' }), '➡️');
    assert.equal(maneuverIcon({ type: 'turn', modifier: 'uturn' }), '↩️');
    assert.equal(maneuverIcon({ type: 'end of road', modifier: 'left' }), '⬅️');

    assert.equal(maneuverIcon({ type: 'depart', modifier: 'left' }), '🛫');
    assert.equal(maneuverIcon({ type: 'arrive', modifier: 'right' }), '🏁');
    assert.equal(maneuverIcon({ type: 'roundabout', modifier: 'slight left' }), '🔄');
    assert.equal(maneuverIcon({ type: 'merge', modifier: 'slight right' }), '🔀');
    assert.equal(maneuverIcon({ type: 'on ramp', modifier: 'slight left' }), '🛣️');

    // The specific regression: a left turn must never show the right arrow.
    assert.notEqual(maneuverIcon({ type: 'turn', modifier: 'left' }), '➡️');
});

test('every OSRM manoeuvre type reads as an instruction', () => {
    const { formatManeuverText } = loadHelpers();
    const plain = (step) => formatManeuverText(step).replace(/<[^>]+>/g, '');

    assert.equal(plain({ maneuver: { type: 'depart', modifier: 'left' }, name: '' }), 'Head left');
    assert.equal(plain({ maneuver: { type: 'turn', modifier: 'left' }, name: 'Road 16' }), 'Turn left onto Road 16');
    assert.equal(plain({ maneuver: { type: 'turn', modifier: 'uturn' }, name: 'Road 16' }), 'Make a U-turn onto Road 16');
    assert.equal(plain({ maneuver: { type: 'end of road', modifier: 'left' }, name: 'Mirpur Road' }), 'At the end of the road, turn left onto Mirpur Road');
    assert.equal(plain({ maneuver: { type: 'roundabout', modifier: 'slight left', exit: 2 }, name: 'Khamar Bari' }), 'Enter the roundabout and take exit 2 onto Khamar Bari');
    assert.equal(plain({ maneuver: { type: 'exit roundabout', modifier: 'left' }, name: 'Khamar Bari' }), 'Exit the roundabout onto Khamar Bari');
    assert.equal(plain({ maneuver: { type: 'fork', modifier: 'right' }, name: 'Link Road' }), 'Keep right at the fork onto Link Road');
    assert.equal(plain({ maneuver: { type: 'off ramp', modifier: 'right' }, name: 'Exit 5' }), 'Take the exit on the right onto Exit 5');
    assert.equal(plain({ maneuver: { type: 'arrive', modifier: 'right' }, name: '' }), 'Arrive at your destination on the right');

    // Nothing should surface a raw OSRM token to the customer.
    const rawTypes = ['depart', 'turn', 'new name', 'continue', 'end of road', 'fork', 'merge', 'on ramp', 'off ramp', 'roundabout', 'rotary', 'exit roundabout', 'roundabout turn', 'arrive', 'notification'];
    rawTypes.forEach(type => {
        const text = plain({ maneuver: { type, modifier: 'left' }, name: 'Test Road' });
        assert.ok(text.length > 0, `${type} should render text`);
        assert.doesNotMatch(text, /^(new name|end of road|on ramp|off ramp|exit roundabout|roundabout turn|notification)\b/, `${type} leaked a raw OSRM token`);
    });

    // Street names are escaped before being injected as HTML.
    const escaped = formatManeuverText({ maneuver: { type: 'turn', modifier: 'left' }, name: '<img src=x onerror=alert(1)>' });
    assert.doesNotMatch(escaped, /<img/);
    assert.match(escaped, /&lt;img/);
});

test('routing requests and map links are addressed correctly', () => {
    // OSRM takes coordinates as lng,lat — the reverse of the lat,lng pairs the
    // rest of the page uses, so the order in the URL is load-bearing.
    const osrm = locatorSource.match(/const osrmUrl = `([^`]+)`/);
    assert.ok(osrm, 'the OSRM request URL should be present');
    assert.match(osrm[1], /router\.project-osrm\.org\/route\/v1\/driving\//);
    assert.match(osrm[1], /\$\{startLng\},\$\{startLat\};\$\{endLng\},\$\{endLat\}/);
    assert.match(osrm[1], /steps=true/, 'turn-by-turn guidance needs steps');
    assert.match(osrm[1], /geometries=geojson/, 'the route polyline is drawn from geojson');

    // Google Maps URLs API: with an origin when we know one, destination-only
    // when we do not, so Maps can route from wherever the customer opens it.
    const gmapsUrls = [...locatorSource.matchAll(/https:\/\/www\.google\.com\/maps\/dir\/\?api=1[^`'"]*/g)].map(m => m[0]);
    assert.equal(gmapsUrls.length, 2, 'expected a with-origin and a destination-only Maps link');
    gmapsUrls.forEach(url => {
        assert.match(url, /destination=/);
        assert.match(url, /travelmode=driving/);
    });
    assert.ok(gmapsUrls.some(u => u.includes('origin=')), 'the routed link should carry an origin');
    assert.ok(gmapsUrls.some(u => !u.includes('origin=')), 'the unlocated link should omit the origin');
});

test('directions never invent a starting point', () => {
    // The old code silently fell back to a hardcoded coordinate that happened
    // to be a branch's own location, so asking for directions to that branch
    // produced a 0km route from a place the customer never chose.
    const dhanmondi = STORES.find(s => s.area === 'Dhanmondi');
    assert.ok(dhanmondi);

    const directionsFn = locatorSource.match(/window\.getDirectionsToStore[\s\S]*?\n    };/);
    assert.ok(directionsFn, 'getDirectionsToStore should be defined');

    assert.doesNotMatch(directionsFn[0], /defaultStartLat/, 'no hardcoded fallback origin');
    assert.doesNotMatch(
        directionsFn[0],
        new RegExp(String(dhanmondi.lat).replace('.', '\\.')),
        'a branch coordinate must not be baked in as the default origin'
    );

    // Instead it asks the device, and falls back to telling the customer to pick.
    assert.match(directionsFn[0], /requestDeviceLocation\(\)/);
    assert.match(directionsFn[0], /promptForStartingPoint\(store\)/);

    const prompt = locatorSource.match(/function promptForStartingPoint[\s\S]*?\n    }/);
    assert.ok(prompt);
    assert.match(prompt[0], /Use My Location/, 'the prompt points at the location button');
});
