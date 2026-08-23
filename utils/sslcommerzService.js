const SSLCommerzPayment = require('sslcommerz-lts');

/**
 * Initiates an SSLCommerz Sandbox payment session for bKash or Nagad
 */
async function initiateSSLCommerzPayment({ tran_id, amount, orderDetails, user, paymentMethod, successUrl, failUrl, cancelUrl, ipnUrl }) {
    const store_id = process.env.SSLCOMMERZ_STORE_ID || 'testbox';
    const store_passwd = process.env.SSLCOMMERZ_STORE_PASSWORD || 'qwerty';
    const is_live = process.env.SSLCOMMERZ_IS_SANDBOX === 'false'; // default false (sandbox)

    const data = {
        total_amount: amount,
        currency: 'BDT',
        tran_id: tran_id,
        success_url: successUrl,
        fail_url: failUrl,
        cancel_url: cancelUrl,
        ipn_url: ipnUrl,
        shipping_method: 'Courier',
        product_name: `Virtual Try-On Order`,
        product_category: 'Eyewear',
        product_profile: 'general',
        cus_name: user.full_name || 'Customer',
        cus_email: user.email || 'customer@example.com',
        cus_add1: orderDetails.deliveryAddress,
        cus_city: 'Dhaka',
        cus_postcode: '1200',
        cus_country: 'Bangladesh',
        cus_phone: orderDetails.contactNumber,
        ship_name: user.full_name || 'Customer',
        ship_add1: orderDetails.deliveryAddress,
        ship_city: 'Dhaka',
        ship_postcode: '1200',
        ship_country: 'Bangladesh',
        opt_a: paymentMethod, // 'bkash' or 'nagad'
        opt_b: user.id.toString(),
        opt_c: encodeURIComponent(orderDetails.deliveryAddress),
        opt_d: encodeURIComponent(orderDetails.orderNote || '')
    };

    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    const apiResponse = await sslcz.init(data);
    return apiResponse;
}

/**
 * Validates transaction via SSLCommerz validation API
 */
async function validatePayment(val_id) {
    const store_id = process.env.SSLCOMMERZ_STORE_ID || 'testbox';
    const store_passwd = process.env.SSLCOMMERZ_STORE_PASSWORD || 'qwerty';
    const is_live = process.env.SSLCOMMERZ_IS_SANDBOX === 'false';

    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    const response = await sslcz.validate({ val_id });
    return response;
}

module.exports = {
    initiateSSLCommerzPayment,
    validatePayment
};
