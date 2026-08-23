const db = require('../models/Database');
const stripeService = require('../utils/stripeService');
const sslcommerzService = require('../utils/sslcommerzService');
const emailService = require('../utils/emailService');

/**
 * Handle Stripe Payment Success Callback (GET /customer/payment/stripe/success)
 */
exports.handleStripeSuccess = async (req, res) => {
    try {
        const { session_id } = req.query;
        if (!session_id) {
            return res.redirect('/customer/checkout?error=invalid_session');
        }

        const session = await stripeService.retrieveSession(session_id);
        if (!session || session.payment_status !== 'paid') {
            return res.redirect('/customer/checkout?error=payment_not_completed');
        }

        const metadata = session.metadata || {};
        const userId = parseInt(metadata.userId || (req.user ? req.user.id : 0), 10);
        if (!userId) {
            return res.redirect('/customer/checkout?error=user_not_found');
        }

        // Get user cart items
        const cartItems = await db.getUserCart(userId);
        if (!cartItems || cartItems.length === 0) {
            // Check if order was already created for this session (idempotency check)
            const existingPayment = await db.getPaymentByTransactionId(session.payment_intent || session.id);
            if (existingPayment) {
                return res.redirect(`/customer/order-tracking/${existingPayment.order_id}?placed=1`);
            }
            return res.redirect('/customer/cart?error=cart_empty');
        }

        // Calculate totals
        let subtotal = parseFloat(metadata.subtotal);
        let deliveryCharge = parseFloat(metadata.deliveryCharge);
        let totalAmount = parseFloat(metadata.totalAmount);

        if (isNaN(subtotal) || isNaN(totalAmount)) {
            subtotal = 0;
            cartItems.forEach(item => { subtotal += item.price * item.quantity; });
            deliveryCharge = subtotal < 200 ? 5.00 : 0;
            totalAmount = subtotal + deliveryCharge;
        }

        // Generate Order Number
        const timestamp = Date.now().toString().slice(-6);
        const randomCode = Math.floor(1000 + Math.random() * 9000);
        const orderNumber = `ORD-${timestamp}-${randomCode}`;

        // Create Order in DB
        const orderId = await db.createOrder({
            userId,
            orderNumber,
            deliveryAddress: metadata.deliveryAddress || 'Address provided at checkout',
            contactNumber: metadata.contactNumber || 'N/A',
            orderNote: metadata.orderNote || null,
            paymentMethod: 'card',
            subtotal,
            deliveryCharge,
            totalAmount,
            status: 'Placed',
            paymentStatus: 'paid'
        });

        // Create Order Items
        await db.createOrderItems(orderId, cartItems);

        // Record Payment in DB
        const transactionId = session.payment_intent || session.id;
        await db.createPayment({
            orderId,
            transactionId,
            paymentMethod: 'card',
            paymentGateway: 'stripe',
            amount: totalAmount,
            currency: 'BDT',
            status: 'completed',
            gatewayResponse: JSON.stringify({
                sessionId: session.id,
                paymentIntent: session.payment_intent,
                customerEmail: session.customer_email,
                paymentStatus: session.payment_status
            })
        });

        // Clear user cart
        await db.clearCart(userId);

        // Fetch user & order for confirmation email
        const userObj = (req.user && req.user.id === userId) ? req.user : await db.getUserById(userId);
        const order = await db.getOrderById(orderId, userId);

        if (order && userObj) {
            console.log(`Sending order confirmation email to ${userObj.email} for order #${order.order_number}...`);
            await emailService.sendOrderConfirmationEmail(order, userObj).catch(err => {
                console.error("Email send error during Stripe checkout:", err);
            });
        }

        res.render('customer/payment-success', {
            title: 'Payment Successful',
            user: userObj || req.user,
            currentPage: 'checkout',
            order,
            transactionId,
            amount: totalAmount,
            paymentMethod: 'Credit / Debit Card (Stripe)'
        });
    } catch (err) {
        console.error("Stripe payment success error:", err);
        res.redirect('/customer/checkout?error=payment_verification_failed');
    }
};

/**
 * Handle Stripe Payment Cancel Callback (GET /customer/payment/stripe/cancel)
 */
exports.handleStripeCancel = (req, res) => {
    res.redirect('/customer/checkout?payment_status=cancelled&gateway=stripe');
};

exports.handleSSLCommerzSuccess = async (req, res) => {
    try {
        const payload = req.body || {};
        console.log("Received SSLCommerz Success Callback Payload:", payload);

        const tran_id = payload.tran_id;
        const val_id = payload.val_id || payload.tran_id;
        const amount = payload.amount || payload.store_amount;

        // SSLCommerz returns custom parameters as value_a, value_b, value_c, value_d
        const opt_a = payload.value_a || payload.opt_a;
        const opt_b = payload.value_b || payload.opt_b;
        const opt_c = payload.value_c || payload.opt_c;
        const opt_d = payload.value_d || payload.opt_d;

        if (!tran_id) {
            return res.redirect('/customer/checkout?error=invalid_ssl_response');
        }

        // Determine userId from value_b, req.user, or by parsing tran_id (FORMAT: TRAN-timestamp-userId)
        let userId = parseInt(opt_b || (req.user ? req.user.id : 0), 10);
        if ((!userId || isNaN(userId)) && tran_id && tran_id.startsWith('TRAN-')) {
            const parts = tran_id.split('-');
            if (parts.length >= 3) {
                userId = parseInt(parts[2], 10);
            }
        }

        if (!userId || isNaN(userId)) {
            console.error("SSLCommerz Error: Could not determine userId from callback payload", payload);
            return res.redirect('/customer/checkout?error=user_not_found');
        }

        // Validate transaction with SSLCommerz if not in default sandbox
        if (val_id && process.env.SSLCOMMERZ_STORE_ID !== 'testbox') {
            try {
                const validationResponse = await sslcommerzService.validatePayment(val_id);
                if (validationResponse && validationResponse.status !== 'VALID' && validationResponse.status !== 'VALIDATED') {
                    console.warn("SSLCommerz validation status:", validationResponse.status);
                }
            } catch (vErr) {
                console.warn("SSLCommerz validation check notice:", vErr.message);
            }
        }

        // Check idempotency (if order for this transaction ID was already created)
        const existingPayment = await db.getPaymentByTransactionId(val_id || tran_id);
        if (existingPayment) {
            return res.redirect(`/customer/order-tracking/${existingPayment.order_id}?placed=1`);
        }

        // Fetch user cart
        const cartItems = await db.getUserCart(userId);
        if (!cartItems || cartItems.length === 0) {
            console.warn(`User #${userId} cart is empty during SSLCommerz callback.`);
            return res.redirect('/customer/my-orders');
        }

        // Calculate totals
        let subtotal = 0;
        cartItems.forEach(item => { subtotal += item.price * item.quantity; });
        const deliveryCharge = subtotal < 200 ? 5.00 : 0;
        const totalAmount = parseFloat(amount) || (subtotal + deliveryCharge);

        // Determine paymentMethod (bKash vs Nagad) reliably from opt_a, card_type, card_brand, or tran_id
        let paymentMethod = 'bkash';
        const searchTarget = `${opt_a || ''} ${payload.card_type || ''} ${payload.card_brand || ''} ${tran_id || ''}`.toLowerCase();
        if (searchTarget.includes('nagad')) {
            paymentMethod = 'nagad';
        } else if (searchTarget.includes('bkash')) {
            paymentMethod = 'bkash';
        }
        
        let deliveryAddress = 'Delivery Address';
        if (opt_c) {
            try { deliveryAddress = decodeURIComponent(opt_c); } catch (e) { deliveryAddress = opt_c; }
        } else if (payload.cus_add1) {
            deliveryAddress = payload.cus_add1;
        }

        let orderNote = null;
        if (opt_d) {
            try { orderNote = decodeURIComponent(opt_d); } catch (e) { orderNote = opt_d; }
        }

        // Generate Order Number
        const timestamp = Date.now().toString().slice(-6);
        const randomCode = Math.floor(1000 + Math.random() * 9000);
        const orderNumber = `ORD-${timestamp}-${randomCode}`;

        const contactNumber = payload.cus_phone || 'N/A';

        // Create Order in DB
        const orderId = await db.createOrder({
            userId,
            orderNumber,
            deliveryAddress,
            contactNumber,
            orderNote,
            paymentMethod,
            subtotal,
            deliveryCharge,
            totalAmount,
            status: 'Placed',
            paymentStatus: 'paid'
        });

        // Create Order Items
        await db.createOrderItems(orderId, cartItems);

        // Record Payment in DB
        const transactionId = val_id || tran_id;
        await db.createPayment({
            orderId,
            transactionId,
            paymentMethod,
            paymentGateway: 'sslcommerz',
            amount: totalAmount,
            currency: 'BDT',
            status: 'completed',
            gatewayResponse: JSON.stringify({
                tran_id,
                val_id,
                card_type: payload.card_type,
                store_amount: payload.store_amount,
                bank_tran_id: payload.bank_tran_id
            })
        });

        // Clear Cart
        await db.clearCart(userId);

        // Fetch user & order for confirmation email
        const userObj = (req.user && req.user.id === userId) ? req.user : await db.getUserById(userId);
        const order = await db.getOrderById(orderId, userId);

        if (order && userObj) {
            console.log(`Sending order confirmation email to ${userObj.email} for order #${order.order_number}...`);
            await emailService.sendOrderConfirmationEmail(order, userObj).catch(err => {
                console.error("Email send error during SSLCommerz checkout:", err);
            });
        }

        res.render('customer/payment-success', {
            title: 'Payment Successful',
            user: userObj || req.user,
            currentPage: 'checkout',
            order,
            transactionId,
            amount: totalAmount,
            paymentMethod: paymentMethod === 'bkash' ? 'bKash Mobile Wallet (SSLCommerz)' : 'Nagad Digital Wallet (SSLCommerz)'
        });
    } catch (err) {
        console.error("SSLCommerz payment success error:", err);
        res.redirect('/customer/checkout?error=sslcommerz_processing_failed');
    }
};

/**
 * Handle SSLCommerz Payment Fail Callback (POST /customer/payment/sslcommerz/fail)
 */
exports.handleSSLCommerzFail = (req, res) => {
    res.redirect('/customer/checkout?payment_status=failed&gateway=sslcommerz');
};

/**
 * Handle SSLCommerz Payment Cancel Callback (POST /customer/payment/sslcommerz/cancel)
 */
exports.handleSSLCommerzCancel = (req, res) => {
    res.redirect('/customer/checkout?payment_status=cancelled&gateway=sslcommerz');
};

/**
 * Handle SSLCommerz IPN (Server-to-Server) Callback (POST /customer/payment/sslcommerz/ipn)
 */
exports.handleSSLCommerzIPN = async (req, res) => {
    try {
        const payload = req.body;
        console.log("Received SSLCommerz IPN notification:", payload);
        res.status(200).send("IPN Received");
    } catch (err) {
        console.error("SSLCommerz IPN error:", err);
        res.status(500).send("IPN Error");
    }
};
