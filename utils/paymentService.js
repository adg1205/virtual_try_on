const { roundCurrency } = require('./cartService');

const PAID_STATUSES = new Set(['paid', 'completed', 'succeeded', 'valid', 'validated']);

class PaymentValidationError extends Error {
    constructor(message, code = 'invalid_payment') {
        super(message);
        this.name = 'PaymentValidationError';
        this.code = code;
    }
}

function normalizeCurrency(value) {
    return String(value || '').trim().toUpperCase();
}

function amountsMatch(actual, expected) {
    const normalizedActual = roundCurrency(actual);
    const normalizedExpected = roundCurrency(expected);
    return Number.isFinite(normalizedActual)
        && Number.isFinite(normalizedExpected)
        && Math.abs(normalizedActual - normalizedExpected) < 0.01;
}

function createPaymentRecord({
    transactionId,
    paymentMethod,
    paymentGateway,
    amount,
    currency = 'BDT',
    status = 'completed',
    gatewayResponse,
    paidAt = new Date().toISOString()
}) {
    if (!transactionId) {
        throw new PaymentValidationError('Gateway transaction ID is missing', 'missing_transaction_id');
    }

    return {
        transactionId: String(transactionId),
        paymentMethod,
        paymentGateway,
        amount: roundCurrency(amount),
        currency: normalizeCurrency(currency) || 'BDT',
        status,
        gatewayResponse: JSON.stringify(gatewayResponse || {}),
        paidAt
    };
}

function validateStripeSession(session, expectedAmount) {
    if (!session || String(session.payment_status || '').toLowerCase() !== 'paid') {
        throw new PaymentValidationError('Stripe payment has not completed', 'payment_not_completed');
    }

    const amount = roundCurrency(Number(session.amount_total) / 100);
    const currency = normalizeCurrency(session.currency);
    if (currency !== 'BDT') {
        throw new PaymentValidationError('Stripe payment currency does not match BDT', 'currency_mismatch');
    }
    if (!amountsMatch(amount, expectedAmount)) {
        throw new PaymentValidationError('Stripe payment amount does not match the order total', 'amount_mismatch');
    }

    const paymentIntent = typeof session.payment_intent === 'object'
        ? session.payment_intent.id
        : session.payment_intent;

    return createPaymentRecord({
        transactionId: paymentIntent || session.id,
        paymentMethod: 'card',
        paymentGateway: 'stripe',
        amount,
        currency,
        status: 'completed',
        gatewayResponse: {
            sessionId: session.id,
            paymentIntent: paymentIntent || null,
            customerEmail: session.customer_details?.email || session.customer_email || null,
            paymentStatus: session.payment_status
        }
    });
}

function validateSSLCommerzTransaction(validationResponse, callbackPayload, expectedAmount, paymentMethod) {
    const validation = validationResponse || {};
    const payload = callbackPayload || {};
    const status = String(validation.status || '').trim().toLowerCase();

    if (!PAID_STATUSES.has(status)) {
        throw new PaymentValidationError('SSLCommerz transaction validation failed', 'payment_not_valid');
    }

    const amount = roundCurrency(validation.amount ?? payload.amount ?? payload.store_amount);
    const currency = normalizeCurrency(validation.currency || validation.currency_type || payload.currency || 'BDT');
    if (currency !== 'BDT') {
        throw new PaymentValidationError('SSLCommerz payment currency does not match BDT', 'currency_mismatch');
    }
    if (!amountsMatch(amount, expectedAmount)) {
        throw new PaymentValidationError('SSLCommerz payment amount does not match the order total', 'amount_mismatch');
    }

    const providerTransactionId = validation.bank_tran_id
        || payload.bank_tran_id
        || validation.tran_id
        || payload.tran_id;

    return createPaymentRecord({
        transactionId: providerTransactionId,
        paymentMethod,
        paymentGateway: 'sslcommerz',
        amount,
        currency,
        status: 'completed',
        gatewayResponse: {
            tran_id: validation.tran_id || payload.tran_id || null,
            val_id: validation.val_id || payload.val_id || null,
            bank_tran_id: validation.bank_tran_id || payload.bank_tran_id || null,
            card_type: validation.card_type || payload.card_type || null,
            store_amount: validation.store_amount || payload.store_amount || null,
            validation_status: validation.status
        }
    });
}

module.exports = {
    PaymentValidationError,
    amountsMatch,
    normalizeCurrency,
    validateStripeSession,
    validateSSLCommerzTransaction
};
