const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

/**
 * Creates a Stripe Checkout Session for Card Payments
 */
async function createCheckoutSession({ amount, orderDetails, user, successUrl, cancelUrl }) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    
    // Check if valid API key is present
    if (!apiKey || apiKey.includes('your_key') || apiKey === 'sk_test_placeholder') {
        throw new Error("Stripe secret key (STRIPE_SECRET_KEY) is missing or invalid in .env file.");
    }

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
            price_data: {
                currency: 'bdt',
                product_data: {
                    name: `Virtual Try-On Purchase (${orderDetails.cartItems.length} items)`,
                    description: `Customer: ${user.full_name || user.email} | Contact: ${orderDetails.contactNumber}`,
                },
                unit_amount: Math.round(amount * 100), // convert to poisha (integer)
            },
            quantity: 1,
        }],
        mode: 'payment',
        customer_email: user.email,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
            userId: user.id.toString(),
            deliveryAddress: orderDetails.deliveryAddress,
            contactNumber: orderDetails.contactNumber,
            orderNote: orderDetails.orderNote || '',
            paymentMethod: 'card',
            subtotal: orderDetails.subtotal.toString(),
            deliveryCharge: orderDetails.deliveryCharge.toString(),
            totalAmount: amount.toString()
        }
    });

    return session;
}

/**
 * Retrieves a Stripe session by ID to verify payment completion
 */
async function retrieveSession(sessionId) {
    return await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent']
    });
}

module.exports = {
    createCheckoutSession,
    retrieveSession
};
