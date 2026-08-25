const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { STORES, DHAKA_AREAS } = require('../utils/storeData');

const locatorSource = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'js', 'nearby-stores.js'),
    'utf8'
);

// calculateDistance is a pure helper inside the browser module. Lift the real
// shipped source rather than restating the formula, so the test fails if the
// distance maths in the page ever changes.
function loadCalculateDistance() {
    const match = locatorSource.match(/function calculateDistance\([\s\S]*?\n    }/);
    assert.ok(match, 'nearby-stores.js should define calculateDistance');
    return new Function(`${match[0]}; return calculateDistance;`)();
}

test('every optical branch carries the details the locator lists', () => {
    assert.ok(STORES.length > 0, 'the locator needs at least one branch');

    const seenIds = new Set();
    STORES.forEach(store => {
        assert.ok(store.name, 'branch name');
        assert.ok(store.address, `address for ${store.name}`);
        assert.ok(store.hours, `opening hours for ${store.name}`);
        assert.ok(store.phone, `contact number for ${store.name}`);
        assert.ok(store.area, `area for ${store.name}`);

        // Distance is computed from these, so they must be real numbers inside
        // the Dhaka bounding box rather than placeholders.
        assert.equal(typeof store.lat, 'number');
        assert.equal(typeof store.lng, 'number');
        assert.ok(store.lat > 23.6 && store.lat < 24.0, `latitude for ${store.name}`);
        assert.ok(store.lng > 90.2 && store.lng < 90.6, `longitude for ${store.name}`);

        assert.equal(seenIds.has(store.id), false, `duplicate branch id ${store.id}`);
        seenIds.add(store.id);
    });
});

test('manual area selection offers usable coordinates for every area', () => {
    assert.ok(DHAKA_AREAS.length > 0, 'the manual picker needs areas to choose from');

    DHAKA_AREAS.forEach(area => {
        assert.ok(area.name, 'area name');
        assert.equal(typeof area.lat, 'number');
        assert.equal(typeof area.lng, 'number');
        assert.ok(area.lat > 23.6 && area.lat < 24.0, `latitude for ${area.name}`);
        assert.ok(area.lng > 90.2 && area.lng < 90.6, `longitude for ${area.name}`);
    });

    // Picking an area should surface a branch that is genuinely close to it.
    const calculateDistance = loadCalculateDistance();
    DHAKA_AREAS.forEach(area => {
        const nearest = STORES
            .map(store => calculateDistance(area.lat, area.lng, store.lat, store.lng))
            .sort((a, b) => a - b)[0];
        assert.ok(nearest < 12, `${area.name} should have a branch within 12km, nearest was ${nearest.toFixed(1)}km`);
    });
});

test('distance between branches is measured, not guessed', () => {
    const calculateDistance = loadCalculateDistance();

    const dhanmondi = STORES.find(s => s.area === 'Dhanmondi');
    const gulshan = STORES.find(s => s.area === 'Gulshan');
    assert.ok(dhanmondi && gulshan);

    const d = calculateDistance(dhanmondi.lat, dhanmondi.lng, gulshan.lat, gulshan.lng);
    assert.ok(d > 6 && d < 8, `Dhanmondi to Gulshan should be roughly 7km, got ${d.toFixed(2)}km`);

    // A branch is zero km from itself, and distance does not depend on direction.
    assert.equal(calculateDistance(dhanmondi.lat, dhanmondi.lng, dhanmondi.lat, dhanmondi.lng), 0);
    const there = calculateDistance(dhanmondi.lat, dhanmondi.lng, gulshan.lat, gulshan.lng);
    const back = calculateDistance(gulshan.lat, gulshan.lng, dhanmondi.lat, dhanmondi.lng);
    assert.ok(Math.abs(there - back) < 1e-9);

    // Sorting nearest-first is what the locator promises.
    const origin = DHAKA_AREAS.find(a => a.name === 'Uttara');
    const ordered = STORES
        .map(s => ({ area: s.area, km: calculateDistance(origin.lat, origin.lng, s.lat, s.lng) }))
        .sort((a, b) => a.km - b.km);
    for (let i = 1; i < ordered.length; i++) {
        assert.ok(ordered[i].km >= ordered[i - 1].km, 'results must be ordered nearest first');
    }
    assert.equal(ordered[0].area, 'Uttara', 'the Uttara branch is nearest to the Uttara area centre');
});

test('each tile provider is configured with its own tile geometry', () => {
    // MapTiler serves 512px tiles and needs zoomOffset -1; the OpenStreetMap
    // tile server serves 256px. Sharing one tileSize between them upscales OSM
    // tiles and shows the map a zoom level short.
    const osmBlock = locatorSource.match(/url: 'https:\/\/tile\.openstreetmap\.org[\s\S]*?\n        \};/);
    assert.ok(osmBlock, 'the OpenStreetMap tile layer config should be present');
    assert.match(osmBlock[0], /tileSize: 256/);
    assert.match(osmBlock[0], /zoomOffset: 0/);

    const maptilerBlock = locatorSource.match(/url: `https:\/\/api\.maptiler\.com[\s\S]*?\n            \};/);
    assert.ok(maptilerBlock, 'the MapTiler tile layer config should be present');
    assert.match(maptilerBlock[0], /tileSize: 512/);
    assert.match(maptilerBlock[0], /zoomOffset: -1/);

    // The MapTiler branch must be skipped while the key is still the example
    // placeholder, otherwise a fresh clone requests tiles with a bad key.
    assert.match(locatorSource, /mapTilerKey !== 'your_maptiler_api_key_here'/);
});
