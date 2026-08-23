const crypto = require('node:crypto');

const DELIVERY_THRESHOLD = 200;
const FLAT_DELIVERY_FEE = 5;
const MIN_QUANTITY = 1;
const MAX_QUANTITY = 10;
const PAYMENT_METHODS = Object.freeze(['cod', 'card', 'bkash', 'nagad']);

function roundCurrency(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function parsePositiveInteger(value) {
    if (typeof value === 'number' && Number.isInteger(value)) return value;
    if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return null;
    return Number.parseInt(value, 10);
}

function normalizeQuantity(value, { defaultValue = null } = {}) {
    if ((value === undefined || value === null || value === '') && defaultValue !== null) {
        return defaultValue;
    }

    const quantity = parsePositiveInteger(value);
    return quantity !== null && quantity >= MIN_QUANTITY && quantity <= MAX_QUANTITY
        ? quantity
        : null;
}

function normalizeCartId(value) {
    const id = parsePositiveInteger(value);
    return id && id > 0 ? id : null;
}

function normalizeSelectedVariant(value, fallback = null) {
    const selected = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
    if (!selected) return fallback;
    return selected.slice(0, 60);
}

function calculateCartSummary(items = [], {
    deliveryThreshold = DELIVERY_THRESHOLD,
    flatDeliveryFee = FLAT_DELIVERY_FEE,
    discount = 0
} = {}) {
    const normalizedItems = Array.isArray(items) ? items : [];
    let subtotal = 0;
    let totalItemCount = 0;

    const itemSubtotals = normalizedItems.map(item => {
        const price = Number(item?.price ?? item?.unit_price ?? item?.frame_price ?? 0);
        const quantity = Number(item?.quantity ?? 0);
        const safePrice = Number.isFinite(price) && price >= 0 ? price : 0;
        const safeQuantity = Number.isInteger(quantity) && quantity > 0 ? quantity : 0;
        const itemSubtotal = roundCurrency(safePrice * safeQuantity);

        subtotal += itemSubtotal;
        totalItemCount += safeQuantity;

        return {
            id: item?.id ?? item?.cart_item_id ?? null,
            frameId: item?.frame_id ?? item?.frameId ?? null,
            subtotal: itemSubtotal
        };
    });

    subtotal = roundCurrency(subtotal);
    const safeDiscount = Math.min(subtotal, Math.max(0, Number(discount) || 0));
    const deliveryCharge = normalizedItems.length > 0 && subtotal < deliveryThreshold
        ? roundCurrency(flatDeliveryFee)
        : 0;
    const totalAmount = roundCurrency(Math.max(0, subtotal + deliveryCharge - safeDiscount));

    return {
        subtotal,
        deliveryCharge,
        totalAmount,
        totalItemCount,
        discount: roundCurrency(safeDiscount),
        deliveryThreshold,
        flatDeliveryFee,
        freeDeliveryRemaining: roundCurrency(Math.max(0, deliveryThreshold - subtotal)),
        hasFreeDelivery: normalizedItems.length > 0 && subtotal >= deliveryThreshold,
        itemSubtotals
    };
}

function normalizePaymentMethod(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'mfs' || normalized === 'sslcommerz') return 'bkash';
    return PAYMENT_METHODS.includes(normalized) ? normalized : null;
}

function normalizeCheckoutText(value, { required = false, maxLength }) {
    const normalized = typeof value === 'string'
        ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
        : '';

    if (required && !normalized) return null;
    return normalized ? normalized.slice(0, maxLength) : null;
}

function normalizeCheckoutDetails({ deliveryAddress, contactNumber, orderNote, paymentMethod } = {}) {
    return {
        deliveryAddress: normalizeCheckoutText(deliveryAddress, { required: true, maxLength: 500 }),
        contactNumber: normalizeCheckoutText(contactNumber, { required: true, maxLength: 40 }),
        orderNote: normalizeCheckoutText(orderNote, { required: false, maxLength: 500 }),
        paymentMethod: normalizePaymentMethod(paymentMethod)
    };
}

function createOrderNumber(now = new Date()) {
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `ORD-${date}-${suffix}`;
}

module.exports = {
    DELIVERY_THRESHOLD,
    FLAT_DELIVERY_FEE,
    MIN_QUANTITY,
    MAX_QUANTITY,
    PAYMENT_METHODS,
    roundCurrency,
    normalizeQuantity,
    normalizeCartId,
    normalizeSelectedVariant,
    calculateCartSummary,
    normalizePaymentMethod,
    normalizeCheckoutDetails,
    createOrderNumber
};
