const test = require('node:test');
const assert = require('node:assert/strict');

const emailService = require('../utils/emailService');

test('Nodemailer confirmation contains order summary and stored payment details', async () => {
    let capturedMessage = null;
    const fakeTransport = {
        async sendMail(message) {
            capturedMessage = message;
            return { messageId: 'test-message-id' };
        }
    };

    const order = {
        id: 42,
        order_number: 'ORD-TEST-42',
        created_at: '2026-08-25 10:00:00',
        payment_method: 'card',
        payment_status: 'paid',
        subtotal: 150,
        delivery_charge: 5,
        total_amount: 155,
        delivery_address: 'Dhaka, Bangladesh',
        contact_number: '01700000000',
        order_note: 'Call before delivery',
        items: [{
            frame_name: 'Classic Aviator',
            brand: 'Ray-Ban',
            lens_option: 'Clear Lens',
            selected_variant: 'Gold',
            quantity: 1,
            unit_price: 150,
            line_total: 150
        }],
        payment: {
            transaction_id: 'pi_test_email_42',
            payment_gateway: 'stripe',
            amount: 155,
            status: 'completed',
            paid_at: '2026-08-25T10:05:00.000Z'
        }
    };

    const sent = await emailService.sendOrderConfirmationEmail(order, {
        full_name: 'Email Test Customer',
        email: 'email-test@example.com'
    }, fakeTransport);

    assert.equal(sent, true);
    assert.equal(capturedMessage.to, 'email-test@example.com');
    assert.match(capturedMessage.subject, /ORD-TEST-42/);
    assert.match(capturedMessage.html, /Classic Aviator/);
    assert.match(capturedMessage.html, /Paid/);
    assert.match(capturedMessage.html, /STRIPE/);
    assert.match(capturedMessage.html, /pi_test_email_42/);
    assert.match(capturedMessage.html, /৳155\.00/);
    assert.match(capturedMessage.text, /Payment Status: Paid/);
    assert.match(capturedMessage.text, /Transaction ID: pi_test_email_42/);
    assert.match(capturedMessage.text, /Payment Time:/);
});
