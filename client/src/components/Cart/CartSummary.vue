<template>
  <div class="glass-panel cart-summary-panel">
    <h3 class="cart-summary-title">Order Summary</h3>

    <div class="cart-summary-breakdown">
      <div class="d-flex justify-content-between mb-2">
        <span class="text-white-50">Subtotal ({{ totalItems }} items)</span>
        <span class="text-white font-weight-600">৳{{ subtotal.toFixed(2) }}</span>
      </div>

      <div v-if="discount > 0" class="d-flex justify-content-between mb-2 text-success">
        <span>Promo Discount</span>
        <span>-৳{{ discount.toFixed(2) }}</span>
      </div>

      <div class="d-flex justify-content-between mb-2 text-white-50">
        <span>Delivery Fee</span>
        <span v-if="deliveryCharge === 0" class="badge bg-success-subtle text-success font-weight-700">FREE</span>
        <span v-else class="text-white font-weight-600">৳{{ deliveryCharge.toFixed(2) }}</span>
      </div>

      <!-- Free Delivery Progress / Notice -->
      <div v-if="deliveryCharge > 0 && subtotal > 0" class="delivery-notice-box mb-3 p-2 rounded-3 bg-dark bg-opacity-50 border border-secondary border-opacity-25 small text-white-50">
        <span>🚚 Add <strong>৳{{ (200 - subtotal).toFixed(2) }}</strong> more to get <strong>FREE Delivery</strong>!</span>
      </div>
      <div v-else-if="subtotal >= 200" class="delivery-notice-box mb-3 p-2 rounded-3 bg-success bg-opacity-10 border border-success border-opacity-25 small text-success font-weight-600">
        <span>🎉 You unlocked <strong>FREE Delivery</strong>!</span>
      </div>

      <hr class="border-secondary border-opacity-25 my-3" />

      <div class="d-flex justify-content-between align-items-center mb-3">
        <span class="fs-6 font-weight-700 text-white">Estimated Total</span>
        <span class="cart-summary-total-val">৳{{ total.toFixed(2) }}</span>
      </div>
    </div>

    <a
      href="/customer/checkout"
      class="btn btn-primary btn-full rounded-pill py-3 font-weight-700 fs-6 d-flex align-items-center justify-content-center gap-2"
    >
      <span>🔒</span> Proceed to Checkout
    </a>

    <div class="cart-security-badge mt-3">
      <span>🛡️</span> 100% Secure Checkout with Free 30-Day Returns
    </div>
  </div>
</template>

<script setup>
defineProps({
  subtotal: { type: Number, required: true },
  deliveryCharge: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  totalItems: { type: Number, required: true }
});
</script>
