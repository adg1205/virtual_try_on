const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'virtual-try-on-commerce-'));
process.env.DB_PATH = path.join(tempDirectory, 'commerce.sqlite');

const db = require('../models/Database');
const { calculateCartSummary, createOrderNumber } = require('../utils/cartService');

test('persists cart selections, atomically creates an order, and calculates activity indicators', async (context) => {
    context.after(async () => {
        await db.closeDatabase();
        fs.rmSync(tempDirectory, { recursive: true, force: true });
    });

    await db.initializeDatabase();
    await db.createUser({
        full_name: 'Commerce Test Customer',
        email: 'commerce-test@example.com',
        password: 'test-password-hash',
        phone_number: '01700000000',
        address: 'Dhaka'
    });

    const user = await db.getUserByEmail('commerce-test@example.com');
    const frames = await db.getAllFrames();
    const availableFrames = frames.filter(frame => frame.availability).slice(0, 2);
    assert.equal(availableFrames.length, 2);

    await db.addToCart(user.id, {
        frameId: availableFrames[0].id,
        lensOption: 'Brown Tint',
        quantity: 2,
        price: availableFrames[0].price,
        selectedVariant: 'Tortoise'
    });

    const cartItems = await db.getUserCart(user.id);
    assert.equal(cartItems.length, 1);
    assert.equal(cartItems[0].frame_id, availableFrames[0].id);
    assert.equal(cartItems[0].lens_option, 'Brown Tint');
    assert.equal(cartItems[0].selected_variant, 'Tortoise');
    assert.equal(cartItems[0].quantity, 2);

    const summary = calculateCartSummary(cartItems);
    const orderId = await db.createOrderFromCart({
        userId: user.id,
        orderNumber: createOrderNumber(),
        deliveryAddress: 'House 1, Road 2, Dhaka',
        contactNumber: '01700000000',
        orderNote: 'Call before delivery',
        paymentMethod: 'cod',
        subtotal: summary.subtotal,
        deliveryCharge: summary.deliveryCharge,
        totalAmount: summary.totalAmount,
        status: 'Placed',
        paymentStatus: 'unpaid'
    }, cartItems);

    const [order, emptiedCart] = await Promise.all([
        db.getOrderById(orderId, user.id),
        db.getUserCart(user.id)
    ]);
    assert.equal(order.delivery_address, 'House 1, Road 2, Dhaka');
    assert.equal(order.contact_number, '01700000000');
    assert.equal(order.payment_method, 'cod');
    assert.equal(order.items.length, 1);
    assert.equal(order.items[0].lens_option, 'Brown Tint');
    assert.equal(order.items[0].selected_variant, 'Tortoise');
    assert.equal(emptiedCart.length, 0);

    await db.addToCart(user.id, {
        frameId: availableFrames[1].id,
        lensOption: 'Clear Lens',
        quantity: 1,
        price: availableFrames[1].price,
        selectedVariant: availableFrames[1].color
    });
    const rollbackCart = await db.getUserCart(user.id);
    await assert.rejects(db.createOrderFromCart({
        userId: user.id,
        orderNumber: createOrderNumber(),
        deliveryAddress: 'Rollback Test Address',
        contactNumber: '01700000000',
        paymentMethod: 'cod',
        subtotal: rollbackCart[0].price,
        deliveryCharge: 5,
        totalAmount: rollbackCart[0].price + 5
    }, [{ ...rollbackCart[0], frame_name: null }]));
    const cartAfterRollback = await db.getUserCart(user.id);
    assert.equal(cartAfterRollback.length, 1);
    await db.removeFromCart(user.id, cartAfterRollback[0].id);

    await db.addToWishlist(user.id, availableFrames[0].id);
    await db.saveTryOnResult({
        userId: user.id,
        frameId: availableFrames[0].id,
        imageUrl: 'https://example.test/try-on.jpg',
        cloudinaryPublicId: 'test/try-on',
        lensOption: 'Brown Tint',
        colorOption: 'Tortoise',
        faceShape: 'Oval'
    });
    await db.logFrameComparison(user.id, availableFrames[0].id, availableFrames[1].id);

    const indicators = await db.getPopularityIndicators(30, 5);
    assert.equal(indicators.mostTried[0].id, availableFrames[0].id);
    assert.equal(indicators.mostWishlisted[0].id, availableFrames[0].id);
    assert.equal(indicators.comparedPairs[0].frame_id_1, Math.min(availableFrames[0].id, availableFrames[1].id));
    assert.ok(indicators.trendingShapes.some(entry => entry.shape === availableFrames[0].shape));
});
