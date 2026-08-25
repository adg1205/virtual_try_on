const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'virtual-try-on-reviews-'));
process.env.DB_PATH = path.join(tempDirectory, 'reviews.sqlite');

const db = require('../models/Database');

test('frame ratings and reviews are gated, stored, and listed for display', async (context) => {
    context.after(async () => {
        await db.closeDatabase();
        fs.rmSync(tempDirectory, { recursive: true, force: true });
    });

    await db.initializeDatabase();

    const createCustomer = async (email) => {
        await db.createUser({
            full_name: `Reviewer ${email}`,
            email,
            password: 'test-password-hash',
            phone_number: '01700000000',
            address: 'Dhaka'
        });
        return db.getUserByEmail(email);
    };

    const browser = await createCustomer('reviews-browser@example.com');
    const author = await createCustomer('reviews-author@example.com');
    const frames = await db.getAllFrames();
    const frame = frames[0];

    // Eligibility: simply viewing a frame does not earn the right to review it.
    assert.equal(await db.checkReviewEligibility(browser.id, frame.id), false);

    await db.saveTryOnResult({
        userId: author.id,
        frameId: frame.id,
        imageUrl: 'https://example.test/try-on/review.png',
        cloudinaryPublicId: 'review',
        lensOption: 'Clear Lens'
    });
    assert.equal(await db.checkReviewEligibility(author.id, frame.id), true);
    assert.equal(await db.checkReviewEligibility(author.id, frames[1].id), false, 'eligibility is per frame, not global');

    // A stored review carries rating, comment, frame, and date.
    await db.createOrUpdateReview(author.id, frame.id, 4, 'Light on the nose and the hinges feel solid.');

    const [stored] = await db.getFrameReviews(frame.id, 5, 0);
    assert.equal(stored.rating, 4);
    assert.equal(stored.comment, 'Light on the nose and the hinges feel solid.');
    assert.equal(stored.frame_id, frame.id);
    assert.ok(stored.updated_at, 'the frame details page renders this as the review date');
    assert.equal(stored.full_name, 'Reviewer reviews-author@example.com', 'the list joins the reviewer name for display');

    const stats = await db.getFrameReviewStats(frame.id);
    assert.equal(stats.total_reviews, 1);
    assert.equal(Number(stats.average_rating), 4);
    assert.equal(stats.count_4, 1);

    // Re-submitting edits in place rather than stacking a second review.
    await db.createOrUpdateReview(author.id, frame.id, 2, 'The coating scratched within a week.');
    const afterEdit = await db.getFrameReviews(frame.id, 5, 0);
    assert.equal(afterEdit.length, 1);
    assert.equal(afterEdit[0].rating, 2);
    assert.equal(afterEdit[0].comment, 'The coating scratched within a week.');

    const editedStats = await db.getFrameReviewStats(frame.id);
    assert.equal(editedStats.total_reviews, 1);
    assert.equal(Number(editedStats.average_rating), 2);

    // The author's own review is retrievable for the edit panel.
    const mine = await db.getUserReviewForFrame(author.id, frame.id);
    assert.equal(mine.rating, 2);
    assert.equal(await db.getUserReviewForFrame(browser.id, frame.id), null);

    // A customer may only remove their own review.
    assert.equal(await db.deleteReview(afterEdit[0].id, browser.id), 0);
    assert.equal(await db.deleteReview(afterEdit[0].id, author.id), 1);
    assert.equal((await db.getFrameReviews(frame.id, 5, 0)).length, 0);
});
