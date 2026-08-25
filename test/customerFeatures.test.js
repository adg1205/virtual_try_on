const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'virtual-try-on-customer-'));
process.env.DB_PATH = path.join(tempDirectory, 'customer.sqlite');

const db = require('../models/Database');
const { normalizeOverlaySettings, validateTryOnImageData } = require('../utils/tryOnService');
const { calculateCartSummary, createOrderNumber } = require('../utils/cartService');

test('persists saved looks and wishlists by user and enforces cancellation stages', async context => {
    context.after(async () => {
        await db.closeDatabase();
        fs.rmSync(tempDirectory, { recursive: true, force: true });
    });

    await db.initializeDatabase();
    await db.createUser({ full_name: 'First Customer', email: 'first@example.com', password: 'hash', phone_number: '01700000001' });
    await db.createUser({ full_name: 'Second Customer', email: 'second@example.com', password: 'hash', phone_number: '01700000002' });
    const firstUser = await db.getUserByEmail('first@example.com');
    const secondUser = await db.getUserByEmail('second@example.com');
    const frame = (await db.getAllFrames()).find(item => item.availability);

    const overlaySettings = normalizeOverlaySettings({ scale: 1.18, offsetX: 0.04, offsetY: -0.03, rotation: 7 });
    const historyId = await db.saveTryOnResult({
        userId: firstUser.id,
        frameId: frame.id,
        imageUrl: 'https://example.test/final.jpg',
        cloudinaryPublicId: 'tryon-results/final',
        lensOption: 'Ocean Blue',
        colorOption: frame.color,
        faceShape: 'Oval',
        overlaySettings: JSON.stringify(overlaySettings)
    });
    const savedLook = await db.getTryOnHistoryById(historyId, firstUser.id);
    assert.deepEqual(JSON.parse(savedLook.overlay_settings), overlaySettings);
    assert.equal(await db.getTryOnHistoryById(historyId, secondUser.id), undefined);
    assert.equal(await db.deleteTryOnHistory(historyId, secondUser.id), 0);

    await db.addToWishlist(firstUser.id, frame.id);
    assert.deepEqual(await db.getUserWishlistIds(firstUser.id), [frame.id]);
    assert.deepEqual(await db.getUserWishlistIds(secondUser.id), []);
    await db.removeFromWishlist(firstUser.id, frame.id);
    assert.deepEqual(await db.getUserWishlistIds(firstUser.id), []);

    await db.addToCart(firstUser.id, {
        frameId: frame.id,
        lensOption: 'Clear Lens',
        quantity: 2,
        price: frame.price,
        selectedVariant: frame.color
    });
    const cart = await db.getUserCart(firstUser.id);
    const summary = calculateCartSummary(cart);
    const orderId = await db.createOrderFromCart({
        userId: firstUser.id,
        orderNumber: createOrderNumber(),
        deliveryAddress: 'Dhaka',
        contactNumber: '01700000001',
        paymentMethod: 'cod',
        subtotal: summary.subtotal,
        deliveryCharge: summary.deliveryCharge,
        totalAmount: summary.totalAmount,
        status: 'Placed',
        paymentStatus: 'unpaid'
    }, cart);

    const orders = await db.getUserOrders(firstUser.id);
    assert.equal(orders[0].items[0].frame_name, frame.name);
    assert.equal(orders[0].total_items, 2);
    await db.updateOrderStatus(orderId, 'Confirmed');
    assert.equal(await db.cancelOrder(orderId, firstUser.id), 1);
    assert.equal((await db.getOrderById(orderId, firstUser.id)).status, 'Cancellation Requested');
    assert.equal(await db.cancelOrder(orderId, firstUser.id), 0);

    assert.equal(validateTryOnImageData('data:image/jpeg;base64,YQ==').valid, true);
    assert.equal(validateTryOnImageData('https://example.test/not-a-data-url.jpg').valid, false);
});
