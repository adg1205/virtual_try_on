const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-catalog-'));
process.env.DB_PATH = path.join(tempDirectory, 'catalog.sqlite');

const db = require('../models/Database');

test('catalog records expose every card field and recommendations use database attributes', async (t) => {
    t.after(async () => {
        await db.closeDatabase();
        fs.rmSync(tempDirectory, { recursive: true, force: true });
    });

    await db.initializeDatabase();

    const frames = await db.getAllFrames();
    assert.ok(frames.length > 0);

    const requiredFields = [
        'image_url',
        'name',
        'brand',
        'shape',
        'color',
        'material',
        'size',
        'price',
        'availability'
    ];

    for (const frame of frames) {
        for (const field of requiredFields) {
            assert.ok(Object.hasOwn(frame, field), `frame ${frame.id} is missing ${field}`);
        }
    }

    const selectedFrame = frames.find((frame) => frame.name === 'Classic Aviator');
    const suggestions = await db.getSimilarFrames(selectedFrame.id, 4);
    const databaseIds = new Set(frames.map((frame) => frame.id));

    assert.ok(suggestions.length > 0);
    assert.ok(suggestions.every((frame) => databaseIds.has(frame.id)));
    assert.ok(suggestions.every((frame) => frame.id !== selectedFrame.id));
    assert.ok(suggestions.some((frame) => frame.matchReasons.includes('size')));
    assert.ok(suggestions.every((frame) =>
        frame.matchReasons.every((reason) => ['shape', 'material', 'color', 'size', 'price'].includes(reason))
    ));

    const scores = suggestions.map((frame) => frame.similarityScore);
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
});
