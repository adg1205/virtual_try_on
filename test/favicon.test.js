const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');

test('pages declare a public favicon and the conventional URL remains compatible', () => {
    const header = fs.readFileSync(path.join(projectRoot, 'views', 'partials', 'header.ejs'), 'utf8');
    const appSource = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
    const favicon = fs.readFileSync(path.join(projectRoot, 'public', 'favicon.svg'), 'utf8');

    assert.match(header, /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml">/);
    assert.match(appSource, /app\.get\('\/favicon\.ico'.*res\.redirect\(308, '\/favicon\.svg'\)\)/);
    assert.match(favicon, /^<svg[^>]+viewBox="0 0 64 64"/);
});
