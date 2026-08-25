const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'virtual-try-on-comparison-'));
process.env.DB_PATH = path.join(tempDirectory, 'comparison.sqlite');

const db = require('../models/Database');
const { createStyleSuggestion } = require('../utils/geminiStylistService');

test('comparison matrix data covers every documented attribute', async (context) => {
    context.after(async () => {
        await db.closeDatabase();
        fs.rmSync(tempDirectory, { recursive: true, force: true });
    });

    await db.initializeDatabase();
    await db.createUser({
        full_name: 'Comparison Test Customer',
        email: 'comparison-test@example.com',
        password: 'test-password-hash',
        phone_number: '01700000000',
        address: 'Dhaka'
    });

    const user = await db.getUserByEmail('comparison-test@example.com');
    const frames = await db.getAllFrames();
    const [frameA, frameB] = frames.slice(0, 2);
    assert.ok(frameA && frameB, 'seeded catalog should expose at least two frames');

    // Price, shape, colour, material, size, and availability all have to reach
    // the matrix from a plain catalog read.
    for (const frame of [frameA, frameB]) {
        assert.ok(Number.isFinite(Number(frame.price)));
        assert.ok(frame.shape);
        assert.ok(frame.color);
        assert.ok(frame.material);
        assert.ok(frame.size, 'size backs the comparison row of the same name');
        assert.notEqual(frame.availability, undefined);
    }

    // Try-on previews: only the newest capture per frame should surface, keyed
    // by frame id so a column can look its own preview up directly.
    await db.saveTryOnResult({
        userId: user.id,
        frameId: frameA.id,
        imageUrl: 'https://example.test/try-on/a-older.png',
        cloudinaryPublicId: 'a-older',
        lensOption: 'Clear Lens',
        colorOption: 'Black',
        faceShape: 'Oval'
    });
    await db.saveTryOnResult({
        userId: user.id,
        frameId: frameA.id,
        imageUrl: 'https://example.test/try-on/a-newest.png',
        cloudinaryPublicId: 'a-newest',
        lensOption: 'Brown Tint',
        colorOption: 'Tortoise',
        faceShape: 'Oval'
    });

    const previews = await db.getLatestTryOnsForUser(user.id);
    assert.equal(previews[frameA.id].image_url, 'https://example.test/try-on/a-newest.png');
    assert.equal(previews[frameA.id].lens_option, 'Brown Tint');
    assert.equal(previews[frameA.id].color_option, 'Tortoise');
    assert.equal(previews[frameA.id].face_shape, 'Oval');
    assert.equal(previews[frameB.id], undefined, 'frames without a capture stay absent so the column can show its empty state');

    // Another customer's captures must never leak into this matrix.
    await db.createUser({
        full_name: 'Other Customer',
        email: 'comparison-other@example.com',
        password: 'test-password-hash',
        phone_number: '01700000001',
        address: 'Dhaka'
    });
    const otherUser = await db.getUserByEmail('comparison-other@example.com');
    await db.saveTryOnResult({
        userId: otherUser.id,
        frameId: frameB.id,
        imageUrl: 'https://example.test/try-on/other.png',
        cloudinaryPublicId: 'other',
        lensOption: 'Clear Lens'
    });
    const previewsAfterOtherUser = await db.getLatestTryOnsForUser(user.id);
    assert.equal(previewsAfterOtherUser[frameB.id], undefined);

    // The AI style suggestion row always resolves to copy, so a missing Gemini
    // key degrades to local styling advice instead of an empty cell.
    const suggestion = await createStyleSuggestion({
        frame: frameA,
        color: 'Tortoise',
        lensStyle: 'Brown Tint',
        faceShape: 'Oval'
    });
    assert.ok(suggestion.suggestion.length > 0);
    assert.ok(['gemini', 'fallback'].includes(suggestion.source));

    // Selecting a pair still records the comparison for trending analytics.
    const comparisonId = await db.logFrameComparison(user.id, frameA.id, frameB.id);
    assert.ok(comparisonId > 0);
});
