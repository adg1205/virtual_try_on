const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveBaseUrl, withProtocol } = require('../utils/baseUrl');

function withEnvironment(values, callback) {
    const original = {};
    for (const [key, value] of Object.entries(values)) {
        original[key] = process.env[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    try {
        callback();
    } finally {
        for (const [key, value] of Object.entries(original)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
}

test('withProtocol normalizes domains and trailing slashes', () => {
    assert.equal(withProtocol('example.vercel.app/'), 'https://example.vercel.app');
    assert.equal(withProtocol('https://shop.example/'), 'https://shop.example');
    assert.equal(withProtocol(''), '');
});

test('resolveBaseUrl prefers an explicitly configured production URL', () => {
    withEnvironment({ BASE_URL: 'https://shop.example/', VERCEL_URL: 'preview.vercel.app' }, () => {
        assert.equal(resolveBaseUrl(), 'https://shop.example');
    });
});

test('resolveBaseUrl uses request host and then Vercel system domains', () => {
    withEnvironment({ BASE_URL: undefined, VERCEL_PROJECT_PRODUCTION_URL: undefined, VERCEL_URL: 'preview.vercel.app' }, () => {
        const request = { protocol: 'https', get: key => key === 'host' ? 'request.example' : undefined };
        assert.equal(resolveBaseUrl(request), 'https://request.example');
        assert.equal(resolveBaseUrl(), 'https://preview.vercel.app');
    });
});
