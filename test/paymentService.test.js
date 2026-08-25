const test = require('node:test');
const assert = require('node:assert/strict');

const {
    PaymentValidationError,
    validateStripeSession,
    validateSSLCommerzTransaction
} = require('../utils/paymentService');

test('normalizes a completed Stripe sandbox session into a payment record', () => {
    const payment = validateStripeSession({
        id: 'cs_test_123',
        payment_status: 'paid',
        amount_total: 15500,
        currency: 'bdt',
        payment_intent: { id: 'pi_test_123' },
        customer_details: { email: 'customer@example.com' }
    }, 155);

    assert.equal(payment.transactionId, 'pi_test_123');
    assert.equal(payment.paymentGateway, 'stripe');
    assert.equal(payment.amount, 155);
    assert.equal(payment.currency, 'BDT');
    assert.equal(payment.status, 'completed');
    assert.ok(payment.paidAt);
});

test('rejects a Stripe callback whose amount does not match the cart total', () => {
    assert.throws(() => validateStripeSession({
        id: 'cs_test_bad_amount',
        payment_status: 'paid',
        amount_total: 10000,
        currency: 'bdt'
    }, 155), (error) => {
        assert.ok(error instanceof PaymentValidationError);
        assert.equal(error.code, 'amount_mismatch');
        return true;
    });
});

test('normalizes a validated SSLCommerz sandbox transaction', () => {
    const payment = validateSSLCommerzTransaction({
        status: 'VALIDATED',
        amount: '205.00',
        currency: 'BDT',
        tran_id: 'TRAN-123-5-bkash',
        val_id: 'VAL-123',
        bank_tran_id: 'BANK-123',
        card_type: 'BKASH-BKash'
    }, {
        tran_id: 'TRAN-123-5-bkash'
    }, 205, 'bkash');

    assert.equal(payment.transactionId, 'BANK-123');
    assert.equal(payment.paymentGateway, 'sslcommerz');
    assert.equal(payment.paymentMethod, 'bkash');
    assert.equal(payment.amount, 205);
    assert.equal(payment.status, 'completed');
});

test('rejects an unvalidated SSLCommerz callback', () => {
    assert.throws(() => validateSSLCommerzTransaction({
        status: 'FAILED',
        amount: '205.00',
        currency: 'BDT'
    }, { tran_id: 'TRAN-failed' }, 205, 'bkash'), PaymentValidationError);
});
