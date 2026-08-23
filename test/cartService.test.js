const test = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeQuantity,
    normalizeCartId,
    normalizeSelectedVariant,
    calculateCartSummary,
    normalizeCheckoutDetails,
    createOrderNumber
} = require('../utils/cartService');

test('calculates item subtotals, delivery charge, and total payable amount', () => {
    const summary = calculateCartSummary([
        { id: 4, frame_id: 11, price: 80, quantity: 2 },
        { id: 7, frame_id: 15, price: 15.25, quantity: 1 }
    ]);

    assert.equal(summary.subtotal, 175.25);
    assert.equal(summary.deliveryCharge, 5);
    assert.equal(summary.totalAmount, 180.25);
    assert.equal(summary.totalItemCount, 3);
    assert.equal(summary.freeDeliveryRemaining, 24.75);
    assert.deepEqual(summary.itemSubtotals, [
        { id: 4, frameId: 11, subtotal: 160 },
        { id: 7, frameId: 15, subtotal: 15.25 }
    ]);
});

test('unlocks free delivery at the configured threshold', () => {
    const summary = calculateCartSummary([{ price: 100, quantity: 2 }]);

    assert.equal(summary.deliveryCharge, 0);
    assert.equal(summary.totalAmount, 200);
    assert.equal(summary.hasFreeDelivery, true);
});

test('never produces negative totals when a discount exceeds the subtotal', () => {
    const summary = calculateCartSummary([{ price: 20, quantity: 1 }], { discount: 50 });

    assert.equal(summary.discount, 20);
    assert.equal(summary.totalAmount, 5);
});

test('validates cart identifiers and quantities strictly', () => {
    assert.equal(normalizeCartId('42'), 42);
    assert.equal(normalizeCartId('-1'), null);
    assert.equal(normalizeQuantity('10'), 10);
    assert.equal(normalizeQuantity('0'), null);
    assert.equal(normalizeQuantity('2.5'), null);
    assert.equal(normalizeQuantity(undefined, { defaultValue: 1 }), 1);
});

test('bounds and normalizes a selected frame variant', () => {
    assert.equal(normalizeSelectedVariant('  Matte   Black  '), 'Matte Black');
    assert.equal(normalizeSelectedVariant('', 'Gold'), 'Gold');
    assert.equal(normalizeSelectedVariant('x'.repeat(100)).length, 60);
});

test('normalizes checkout fields and supported payment aliases', () => {
    const details = normalizeCheckoutDetails({
        deliveryAddress: '  House 1\nRoad 2, Dhaka  ',
        contactNumber: ' 01700000000 ',
        orderNote: ' Call before delivery ',
        paymentMethod: 'SSLCOMMERZ'
    });

    assert.deepEqual(details, {
        deliveryAddress: 'House 1 Road 2, Dhaka',
        contactNumber: '01700000000',
        orderNote: 'Call before delivery',
        paymentMethod: 'bkash'
    });
    assert.equal(normalizeCheckoutDetails({ paymentMethod: 'wire' }).paymentMethod, null);
});

test('creates collision-resistant, date-prefixed order numbers', () => {
    const orderNumber = createOrderNumber(new Date('2026-08-23T12:00:00.000Z'));
    assert.match(orderNumber, /^ORD-20260823-[A-F0-9]{8}$/);
});
