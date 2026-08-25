const db = require('../models/Database');
const stripeService = require('../utils/stripeService');
const sslcommerzService = require('../utils/sslcommerzService');
const emailService = require('../utils/emailService');
const {
    PaymentValidationError,
    validateStripeSession,
    validateSSLCommerzTransaction
} = require('../utils/paymentService');
const { calculateCartSummary, createOrderNumber } = require('../utils/cartService');

function decodeGatewayValue(value, fallback = null) {
    if (!value) return fallback;
    try {
        return decodeURIComponent(value);
    } catch (_error) {
        return value;
    }
}

function getStripeTransactionId(session) {
    if (typeof session?.payment_intent === 'object') return session.payment_intent.id;
    return session?.payment_intent || session?.id || null;
}

function getSSLCommerzPaymentMethod(payload, validation = {}) {
    const source = [
        validation.value_a,
        payload.value_a,
        payload.opt_a,
        validation.card_type,
        payload.card_type,
        payload.card_brand,
        payload.tran_id
    ].filter(Boolean).join(' ').toLowerCase();

    return source.includes('nagad') ? 'nagad' : 'bkash';
}

function getSSLCommerzUserId(payload, validation, requestUser) {
    const explicitValue = validation?.value_b || payload.value_b || payload.opt_b;
    let userId = Number.parseInt(explicitValue || requestUser?.id || 0, 10);

    if ((!userId || Number.isNaN(userId)) && payload.tran_id?.startsWith('TRAN-')) {
        userId = Number.parseInt(payload.tran_id.split('-')[2], 10);
    }

    return Number.isInteger(userId) && userId > 0 ? userId : null;
}

async function getExistingPayment(transactionIds) {
    for (const transactionId of new Set(transactionIds.filter(Boolean).map(String))) {
        const payment = await db.getPaymentByTransactionId(transactionId);
        if (payment) return payment;
    }
    return null;
}

async function sendConfirmation(order, user, gatewayName) {
    if (!order || !user?.email) return false;
    const sent = await emailService.sendOrderConfirmationEmail(order, user);
    if (!sent) {
        console.warn(`${gatewayName} payment was recorded, but the confirmation email could not be sent.`);
    }
    return sent;
}

async function persistPaidOrder({ orderData, cartItems, paymentData }) {
    try {
        return await db.createPaidOrderFromCart(orderData, cartItems, paymentData);
    } catch (error) {
        if (/payments\.transaction_id|unique constraint/i.test(error.message || '')) {
            const existing = await db.getPaymentByTransactionId(paymentData.transactionId);
            if (existing) return existing.order_id;
        }
        throw error;
    }
}

async function completeSSLCommerzPayment(payload, requestUser = null) {
    const tranId = payload?.tran_id;
    const validationId = payload?.val_id;
    if (!tranId || !validationId) {
        throw new PaymentValidationError('SSLCommerz callback is missing transaction validation data', 'invalid_ssl_response');
    }

    // Validation is required in both sandbox and live modes. A browser callback
    // alone is not proof of payment.
    const validation = await sslcommerzService.validatePayment(validationId);
    const userId = getSSLCommerzUserId(payload, validation, requestUser);
    if (!userId) {
        throw new PaymentValidationError('Customer could not be identified from SSLCommerz metadata', 'user_not_found');
    }

    const candidateTransactionId = validation.bank_tran_id
        || payload.bank_tran_id
        || validation.tran_id
        || tranId;
    const existingPayment = await getExistingPayment([candidateTransactionId, tranId]);
    if (existingPayment) {
        const [order, user] = await Promise.all([
            db.getOrderById(existingPayment.order_id, userId),
            db.getUserById(userId)
        ]);
        return { existing: true, order, user, payment: existingPayment };
    }

    const cartItems = await db.getUserCart(userId);
    if (!cartItems.length) {
        throw new PaymentValidationError('The customer cart is empty', 'cart_empty');
    }

    const summary = calculateCartSummary(cartItems);
    const paymentMethod = getSSLCommerzPaymentMethod(payload, validation);
    const paymentData = validateSSLCommerzTransaction(
        validation,
        payload,
        summary.totalAmount,
        paymentMethod
    );

    const deliveryAddress = decodeGatewayValue(
        validation.value_c || payload.value_c || payload.opt_c,
        validation.cus_add1 || payload.cus_add1 || 'Delivery Address'
    );
    const orderNote = decodeGatewayValue(
        validation.value_d || payload.value_d || payload.opt_d,
        null
    );

    const orderId = await persistPaidOrder({
        orderData: {
            userId,
            orderNumber: createOrderNumber(),
            deliveryAddress,
            contactNumber: validation.cus_phone || payload.cus_phone || 'N/A',
            orderNote,
            paymentMethod,
            ...summary,
            status: 'Placed',
            paymentStatus: 'paid'
        },
        cartItems,
        paymentData
    });

    const [order, user] = await Promise.all([
        db.getOrderById(orderId, userId),
        requestUser?.id === userId ? requestUser : db.getUserById(userId)
    ]);
    await sendConfirmation(order, user, 'SSLCommerz');

    return { existing: false, order, user, payment: order.payment };
}

/** Handle Stripe Payment Success Callback. */
exports.handleStripeSuccess = async (req, res) => {
    try {
        const sessionId = req.query.session_id;
        if (!sessionId) {
            return res.redirect('/customer/checkout?error=invalid_session');
        }

        const session = await stripeService.retrieveSession(sessionId);
        const metadata = session.metadata || {};
        const userId = Number.parseInt(metadata.userId || req.user?.id || 0, 10);
        if (!userId) {
            return res.redirect('/customer/checkout?error=user_not_found');
        }

        const transactionId = getStripeTransactionId(session);
        const existingPayment = await getExistingPayment([transactionId, session.id]);
        if (existingPayment) {
            return res.redirect(`/customer/order-tracking/${existingPayment.order_id}?placed=1`);
        }

        const cartItems = await db.getUserCart(userId);
        if (!cartItems.length) {
            return res.redirect('/customer/cart?error=cart_empty');
        }

        const summary = calculateCartSummary(cartItems);
        const paymentData = validateStripeSession(session, summary.totalAmount);
        const orderId = await persistPaidOrder({
            orderData: {
                userId,
                orderNumber: createOrderNumber(),
                deliveryAddress: metadata.deliveryAddress || 'Address provided at checkout',
                contactNumber: metadata.contactNumber || 'N/A',
                orderNote: metadata.orderNote || null,
                paymentMethod: 'card',
                ...summary,
                status: 'Placed',
                paymentStatus: 'paid'
            },
            cartItems,
            paymentData
        });

        const [order, user] = await Promise.all([
            db.getOrderById(orderId, userId),
            req.user?.id === userId ? req.user : db.getUserById(userId)
        ]);
        await sendConfirmation(order, user, 'Stripe');

        return res.render('customer/payment-success', {
            title: 'Payment Successful',
            user,
            currentPage: 'checkout',
            order,
            transactionId: order.payment.transaction_id,
            amount: Number(order.payment.amount),
            paymentMethod: 'Credit / Debit Card (Stripe)'
        });
    } catch (error) {
        console.error('Stripe payment verification error:', error);
        const code = error instanceof PaymentValidationError ? error.code : 'payment_verification_failed';
        return res.redirect(`/customer/checkout?error=${encodeURIComponent(code)}`);
    }
};

exports.handleStripeCancel = (_req, res) => {
    res.redirect('/customer/checkout?payment_status=cancelled&gateway=stripe');
};

/** Handle SSLCommerz browser success callback. */
exports.handleSSLCommerzSuccess = async (req, res) => {
    try {
        const result = await completeSSLCommerzPayment(req.body || {}, req.user);
        if (result.existing) {
            return res.redirect(`/customer/order-tracking/${result.order.id}?placed=1`);
        }

        const methodLabel = result.order.payment_method === 'nagad'
            ? 'Nagad Digital Wallet (SSLCommerz)'
            : 'bKash Mobile Wallet (SSLCommerz)';

        return res.render('customer/payment-success', {
            title: 'Payment Successful',
            user: result.user,
            currentPage: 'checkout',
            order: result.order,
            transactionId: result.payment.transaction_id,
            amount: Number(result.payment.amount),
            paymentMethod: methodLabel
        });
    } catch (error) {
        console.error('SSLCommerz payment verification error:', error);
        const code = error instanceof PaymentValidationError ? error.code : 'sslcommerz_processing_failed';
        return res.redirect(`/customer/checkout?error=${encodeURIComponent(code)}`);
    }
};

exports.handleSSLCommerzFail = (_req, res) => {
    res.redirect('/customer/checkout?payment_status=failed&gateway=sslcommerz');
};

exports.handleSSLCommerzCancel = (_req, res) => {
    res.redirect('/customer/checkout?payment_status=cancelled&gateway=sslcommerz');
};

/** Handle SSLCommerz server-to-server notification. */
exports.handleSSLCommerzIPN = async (req, res) => {
    try {
        const result = await completeSSLCommerzPayment(req.body || {}, req.user);
        return res.status(200).send(result.existing ? 'Payment already recorded' : 'Payment recorded');
    } catch (error) {
        console.error('SSLCommerz IPN verification error:', error);
        const status = error instanceof PaymentValidationError ? 400 : 500;
        return res.status(status).send('Payment verification failed');
    }
};
