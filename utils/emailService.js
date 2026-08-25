const nodemailer = require('nodemailer');

// Configure with real SMTP settings from environment variables
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

function formatDhakaDate(value = new Date()) {
    let dateValue = value;
    if (typeof value === 'string' && !value.endsWith('Z') && !value.includes('+')) {
        dateValue = value.replace(' ', 'T') + 'Z';
    }

    const date = new Date(dateValue);
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    return safeDate.toLocaleString('en-US', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    }) + ' BST';
}

exports.sendVerificationEmail = async (email, token) => {
    const verificationUrl = `http://localhost:3000/verify-email/${token}`;
    const message = {
        from: `"Virtual Try-On" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Verify Your Virtual Try-On Account',
        html: `
            <div style="font-family: sans-serif; padding: 20px;">
                <h2>Welcome to Virtual Try-On!</h2>
                <p>Thank you for signing up. Please click the button below to verify your email address:</p>
                <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #6366f1; color: #ffffff; text-decoration: none; border-radius: 5px;">Verify Email</a>
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <p><a href="${verificationUrl}">${verificationUrl}</a></p>
            </div>
        `
    };

    try {
        await transporter.sendMail(message);
        console.log(`Verification email sent to ${email}`);
        return true;
    } catch (error) {
        console.error("Error sending verification email:", error);
        throw error;
    }
};

exports.sendPasswordResetEmail = async (email, token) => {
    const resetUrl = `http://localhost:3000/reset-password/${token}`;
    const message = {
        from: `"Virtual Try-On" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Reset Your Password - Virtual Try-On',
        html: `
            <div style="font-family: sans-serif; padding: 20px;">
                <h2>Reset Your Password</h2>
                <p>You requested a password reset. Click the button below to set a new password:</p>
                <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #6366f1; color: #ffffff; text-decoration: none; border-radius: 5px;">Reset Password</a>
                <p>If you didn't request this, you can safely ignore this email.</p>
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <p><a href="${resetUrl}">${resetUrl}</a></p>
                <p>This link will expire in 1 hour.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(message);
        console.log(`Password reset email sent to ${email}`);
        return true;
    } catch (error) {
        console.error("Error sending password reset email:", error);
        throw error;
    }
};

exports.sendOrderConfirmationEmail = async (order, user, mailTransport = transporter) => {
    if (!order || !user || !user.email) {
        console.error("Invalid order or user data provided for order confirmation email.");
        return false;
    }

    const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
    const trackingUrl = `${baseUrl}/customer/order-tracking/${order.id}`;
    
    // Payment method mapping
    const methodNames = {
        cod: 'Cash on Delivery (COD)',
        card: 'Credit / Debit Card',
        bkash: 'bKash Mobile Banking',
        nagad: 'Nagad Mobile Banking'
    };
    const paymentMethodLabel = methodNames[order.payment_method] || order.payment_method;
    const storedPaymentStatus = String(
        order.payment_status || order.payment?.status || (order.payment_method === 'cod' ? 'unpaid' : 'pending')
    ).toLowerCase();
    const isPaid = ['paid', 'completed', 'succeeded'].includes(storedPaymentStatus);
    const isFailed = ['failed', 'cancelled', 'canceled'].includes(storedPaymentStatus);
    const paymentStatusLabel = isPaid
        ? 'Paid'
        : (isFailed ? storedPaymentStatus.charAt(0).toUpperCase() + storedPaymentStatus.slice(1) : 'Pending');
    const paymentStatusBadge = isPaid
        ? '<span style="background-color: #10b981; color: #ffffff; padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 0.85rem;">Paid</span>'
        : `<span style="background-color: ${isFailed ? '#ef4444' : '#f59e0b'}; color: #ffffff; padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 0.85rem;">${paymentStatusLabel}${order.payment_method === 'cod' && !isFailed ? ' (Cash on Delivery)' : ''}</span>`;
    const paymentAmount = Number(order.payment?.amount ?? order.total_amount ?? 0);
    const paymentGateway = order.payment?.payment_gateway
        ? String(order.payment.payment_gateway).toUpperCase()
        : (order.payment_method === 'cod' ? 'Cash on Delivery' : 'Pending gateway');

    // Format item rows
    const itemsHtml = (order.items || []).map(item => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 6px; color: #1e293b; word-break: break-word; overflow-wrap: break-word;">
                <strong style="font-size: 0.88rem;">${item.frame_name}</strong> ${item.brand ? `<span style="color: #64748b; font-size: 0.8rem;">(${item.brand})</span>` : ''}<br/>
                <span style="font-size: 0.78rem; color: #64748b;">
                    Lens: ${item.lens_option || 'Standard'}${item.selected_variant ? ` | ${item.selected_variant}` : ''}
                </span>
            </td>
            <td style="padding: 10px 4px; text-align: center; color: #334155; font-size: 0.85rem; vertical-align: top;">${item.quantity}</td>
            <td style="padding: 10px 4px; text-align: right; color: #334155; font-size: 0.85rem; vertical-align: top; white-space: nowrap;">৳${parseFloat(item.unit_price).toFixed(2)}</td>
            <td style="padding: 10px 4px; text-align: right; font-weight: 600; color: #0f172a; font-size: 0.85rem; vertical-align: top; white-space: nowrap;">৳${parseFloat(item.line_total).toFixed(2)}</td>
        </tr>
    `).join('');

    const formattedDate = formatDhakaDate(order.created_at || new Date());
    const formattedPaymentTime = order.payment?.paid_at
        ? formatDhakaDate(order.payment.paid_at)
        : (isPaid ? formattedDate : 'Not paid yet');

    const message = {
        from: `"Virtual Try-On" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: `Order Confirmation - #${order.order_number}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
                <style>
                    @media only screen and (max-width: 480px) {
                        .email-container { padding: 8px !important; }
                        .email-card { border-radius: 8px !important; }
                        .email-body { padding: 14px !important; }
                        .email-header { padding: 18px 14px !important; }
                        .summary-table td { padding: 4px 0 !important; font-size: 0.82rem !important; }
                        .order-table th, .order-table td { padding: 8px 4px !important; font-size: 0.8rem !important; }
                    }
                </style>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: Arial, sans-serif;">
                <div class="email-container" style="background-color: #f8fafc; padding: 16px 8px; color: #334155; box-sizing: border-radius: 0;">
                    <div class="email-card" style="max-width: 600px; width: 100%; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; box-sizing: border-box; word-break: break-word; overflow-wrap: break-word;">
                        
                        <!-- Header -->
                        <div class="email-header" style="background-color: #4f46e5; color: #ffffff; padding: 20px 16px; text-align: center;">
                            <h1 style="margin: 0; font-size: 1.4rem; font-weight: 700; color: #ffffff;">Virtual Try-On</h1>
                            <p style="margin: 6px 0 0 0; font-size: 0.95rem; opacity: 0.95; color: #ffffff;">Order & Payment Confirmation</p>
                        </div>

                        <!-- Body -->
                        <div class="email-body" style="padding: 20px 16px; box-sizing: border-box;">
                            <p style="font-size: 0.95rem; margin-top: 0; color: #1e293b;">Hi <strong>${user.full_name || 'Valued Customer'}</strong>,</p>
                            <p style="color: #475569; line-height: 1.5; font-size: 0.9rem;">Thank you for your purchase! We have received your order <strong style="word-break: break-all;">#${order.order_number}</strong> placed on <strong>${formattedDate}</strong>.</p>

                            <!-- Order & Payment Summary Box -->
                            <div style="background-color: #f1f5f9; border-radius: 8px; padding: 14px; margin: 18px 0; border: 1px solid #cbd5e1; box-sizing: border-box;">
                                <table class="summary-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem; table-layout: fixed;">
                                    <tr>
                                        <td style="padding: 4px 0; color: #64748b; width: 42%; vertical-align: top;">Order Number:</td>
                                        <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #0f172a; width: 58%; word-break: break-all; vertical-align: top;">#${order.order_number}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 4px 0; color: #64748b; vertical-align: top;">Order Date & Time:</td>
                                        <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #0f172a; word-break: break-word; vertical-align: top;">${formattedDate}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 4px 0; color: #64748b; vertical-align: top;">Payment Method:</td>
                                        <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #0f172a; word-break: break-word; vertical-align: top;">${paymentMethodLabel}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 4px 0; color: #64748b; vertical-align: top;">Payment Status:</td>
                                        <td style="padding: 4px 0; text-align: right; vertical-align: top;">${paymentStatusBadge}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 4px 0; color: #64748b; vertical-align: top;">Payment Gateway:</td>
                                        <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #0f172a; vertical-align: top;">${paymentGateway}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 4px 0; color: #64748b; vertical-align: top;">Payment Amount:</td>
                                        <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #0f172a; vertical-align: top;">৳${paymentAmount.toFixed(2)}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 4px 0; color: #64748b; vertical-align: top;">Payment Time:</td>
                                        <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #0f172a; vertical-align: top;">${formattedPaymentTime}</td>
                                    </tr>
                                    ${order.payment ? `
                                    <tr>
                                        <td style="padding: 4px 0; color: #64748b; vertical-align: top;">Transaction ID:</td>
                                        <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #4f46e5; word-break: break-all; overflow-wrap: anywhere; vertical-align: top;"><code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 0.78rem; word-break: break-all;">${order.payment.transaction_id}</code></td>
                                    </tr>
                                    ` : ''}
                                </table>
                            </div>

                            <!-- Order Items Table -->
                            <h3 style="font-size: 1rem; color: #0f172a; margin-bottom: 10px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">Order Details</h3>
                            <table class="order-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-bottom: 18px; table-layout: fixed;">
                                <thead>
                                    <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left;">
                                        <th style="padding: 8px 6px; color: #475569; width: 44%;">Item</th>
                                        <th style="padding: 8px 4px; text-align: center; color: #475569; width: 14%;">Qty</th>
                                        <th style="padding: 8px 4px; text-align: right; color: #475569; width: 21%;">Price</th>
                                        <th style="padding: 8px 4px; text-align: right; color: #475569; width: 21%;">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsHtml}
                                </tbody>
                            </table>

                            <!-- Totals -->
                            <div style="max-width: 280px; width: 100%; margin-left: auto; margin-bottom: 20px;">
                                <table style="width: 100%; font-size: 0.88rem;">
                                    <tr>
                                        <td style="padding: 3px 0; color: #64748b;">Subtotal:</td>
                                        <td style="padding: 3px 0; text-align: right; color: #0f172a;">৳${parseFloat(order.subtotal).toFixed(2)}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 3px 0; color: #64748b;">Delivery Fee:</td>
                                        <td style="padding: 3px 0; text-align: right; color: #0f172a;">৳${parseFloat(order.delivery_charge).toFixed(2)}</td>
                                    </tr>
                                    <tr style="border-top: 2px solid #e2e8f0; font-weight: 700; font-size: 0.95rem;">
                                        <td style="padding: 6px 0 0 0; color: #0f172a;">Total:</td>
                                        <td style="padding: 6px 0 0 0; text-align: right; color: #4f46e5;">৳${parseFloat(order.total_amount).toFixed(2)}</td>
                                    </tr>
                                </table>
                            </div>

                            <!-- Delivery Address -->
                            <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 20px; word-break: break-word; overflow-wrap: break-word;">
                                <h4 style="margin: 0 0 6px 0; color: #0f172a; font-size: 0.9rem;">Shipping & Contact Information</h4>
                                <p style="margin: 0; font-size: 0.85rem; color: #475569; line-height: 1.4;">
                                    <strong>Address:</strong> ${order.delivery_address}<br/>
                                    <strong>Phone:</strong> ${order.contact_number}
                                    ${order.order_note ? `<br/><strong>Note:</strong> ${order.order_note}` : ''}
                                </p>
                            </div>

                            <!-- Call to Action -->
                            <div style="text-align: center; margin: 24px 0 16px 0;">
                                <a href="${trackingUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 11px 24px; border-radius: 8px; font-weight: bold; font-size: 0.9rem;">Track Your Order</a>
                            </div>

                            <p style="font-size: 0.8rem; color: #94a3b8; text-align: center; margin-top: 20px; line-height: 1.4;">
                                If you have any questions, feel free to contact our customer support.<br/>
                                © ${new Date().getFullYear()} Virtual Try-On. All rights reserved.
                            </p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: [
            `Order Confirmation - #${order.order_number}`,
            `Customer: ${user.full_name || user.email}`,
            `Payment Method: ${paymentMethodLabel}`,
            `Payment Status: ${paymentStatusLabel}`,
            `Payment Gateway: ${paymentGateway}`,
            `Transaction ID: ${order.payment?.transaction_id || 'Not available'}`,
            `Payment Amount: BDT ${paymentAmount.toFixed(2)}`,
            `Payment Time: ${formattedPaymentTime}`,
            `Order Total: BDT ${Number(order.total_amount || 0).toFixed(2)}`,
            `Track Order: ${trackingUrl}`
        ].join('\n')
    };

    try {
        await mailTransport.sendMail(message);
        console.log(`Order confirmation email sent to ${user.email} for order #${order.order_number}`);
        return true;
    } catch (error) {
        console.error(`Error sending order confirmation email for order #${order.order_number}:`, error);
        return false;
    }
};

