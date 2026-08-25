const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'virtual-try-on-payment-'));
process.env.DB_PATH = path.join(tempDirectory, 'payment.sqlite');

const db = require('../models/Database');
const { calculateCartSummary, createOrderNumber } = require('../utils/cartService');

test('atomically stores a paid order, gateway transaction, amount, status, and payment time', async (context) => {
    context.after(async () => {
        await db.closeDatabase();
        fs.rmSync(tempDirectory, { recursive: true, force: true });
    });

    await db.initializeDatabase();
    await db.createUser({
        full_name: 'Payment Test Customer',
        email: 'payment-test@example.com',
        password: 'test-password-hash',
        phone_number: '01700000000'
    });

    const user = await db.getUserByEmail('payment-test@example.com');
    const frame = (await db.getAllFrames()).find((item) => item.availability);
    await db.addToCart(user.id, {
        frameId: frame.id,
        lensOption: 'Clear Lens',
        quantity: 1,
        price: frame.price,
        selectedVariant: frame.color
    });

    const cartItems = await db.getUserCart(user.id);
    const summary = calculateCartSummary(cartItems);
    const paidAt = '2026-08-25T10:05:00.000Z';
    const transactionId = 'pi_database_test_123';
    const orderData = {
        userId: user.id,
        orderNumber: createOrderNumber(),
        deliveryAddress: 'Dhaka, Bangladesh',
        contactNumber: '01700000000',
        paymentMethod: 'card',
        ...summary,
        status: 'Placed',
        paymentStatus: 'paid'
    };
    const paymentData = {
        transactionId,
        paymentMethod: 'card',
        paymentGateway: 'stripe',
        amount: summary.totalAmount,
        currency: 'BDT',
        status: 'completed',
        gatewayResponse: JSON.stringify({ sessionId: 'cs_database_test' }),
        paidAt
    };

    const orderId = await db.createPaidOrderFromCart(orderData, cartItems, paymentData);
    const [order, emptiedCart] = await Promise.all([
        db.getOrderById(orderId, user.id),
        db.getUserCart(user.id)
    ]);

    assert.equal(emptiedCart.length, 0);
    assert.equal(order.payment_status, 'paid');
    assert.equal(order.payment.transaction_id, transactionId);
    assert.equal(order.payment.amount, summary.totalAmount);
    assert.equal(order.payment.status, 'completed');
    assert.equal(order.payment.paid_at, paidAt);

    await db.addToCart(user.id, {
        frameId: frame.id,
        lensOption: 'Clear Lens',
        quantity: 1,
        price: frame.price,
        selectedVariant: frame.color
    });
    const duplicateCart = await db.getUserCart(user.id);
    await assert.rejects(
        db.createPaidOrderFromCart({ ...orderData, orderNumber: createOrderNumber() }, duplicateCart, paymentData),
        /transaction_id|unique constraint/i
    );
    assert.equal((await db.getUserCart(user.id)).length, 1);
});
