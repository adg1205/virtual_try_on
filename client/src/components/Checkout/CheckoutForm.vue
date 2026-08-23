<template>
  <div class="checkout-form-root">
    <form @submit.prevent="handleSubmit">
      <div class="checkout-layout-grid">
        <!-- Left: Delivery & Payment Details -->
        <div class="d-flex flex-column gap-4">
          <!-- Shipping Address Panel -->
          <div class="glass-panel checkout-panel">
            <h3 class="panel-section-title">📍 1. Delivery Details</h3>

            <div class="row g-3">
              <div class="col-12 col-md-6">
                <label class="checkout-field-label">Recipient Name</label>
                <input
                  type="text"
                  name="recipient_name"
                  v-model="recipientName"
                  class="form-control checkout-input"
                  placeholder="Full Name"
                  required
                />
              </div>

              <div class="col-12 col-md-6">
                <label class="checkout-field-label">Contact Phone Number</label>
                <input
                  type="tel"
                  name="contact_number"
                  v-model="contactNumber"
                  class="form-control checkout-input"
                  placeholder="01XXXXXXXXX"
                  required
                />
              </div>

              <div class="col-12">
                <label class="checkout-field-label">Delivery Address</label>
                <textarea
                  name="delivery_address"
                  v-model="deliveryAddress"
                  class="form-control checkout-input"
                  rows="3"
                  placeholder="House #, Road #, Area, City (e.g. Dhanmondi, Dhaka)"
                  required
                ></textarea>
              </div>

              <div class="col-12">
                <label class="checkout-field-label">Order Note (Optional)</label>
                <input
                  type="text"
                  name="order_note"
                  v-model="orderNote"
                  class="form-control checkout-input"
                  placeholder="Special instructions for delivery rider..."
                />
              </div>
            </div>
          </div>

          <!-- Payment Options Panel -->
          <div class="glass-panel checkout-panel">
            <h3 class="panel-section-title">💳 2. Payment Method</h3>

            <div class="payment-options-grid">
              <!-- Cash on Delivery (COD) -->
              <div
                class="payment-option-card"
                :class="{ active: selectedPayment === 'cod' }"
                @click="selectedPayment = 'cod'"
              >
                <div class="option-header">
                  <div class="option-radio-icon"></div>
                  <span class="option-icon">💵</span>
                  <div class="flex-grow-1">
                    <div class="option-title">Cash on Delivery (COD)</div>
                    <div class="option-subtitle">Pay with cash when your optical frames arrive at your doorstep.</div>
                  </div>
                </div>
              </div>

              <!-- bKash Mobile Wallet (SSLCommerz) -->
              <div
                class="payment-option-card"
                :class="{ active: selectedPayment === 'bkash' }"
                @click="selectedPayment = 'bkash'"
              >
                <div class="option-header">
                  <div class="option-radio-icon"></div>
                  <span class="option-icon-bkash">bKash</span>
                  <div class="flex-grow-1">
                    <div class="option-title">bKash Mobile Wallet</div>
                    <div class="option-subtitle">Instant, secure checkout via official SSLCommerz Gateway.</div>
                  </div>
                </div>
              </div>

              <!-- Nagad Digital Payment (SSLCommerz) -->
              <div
                class="payment-option-card"
                :class="{ active: selectedPayment === 'nagad' }"
                @click="selectedPayment = 'nagad'"
              >
                <div class="option-header">
                  <div class="option-radio-icon"></div>
                  <span class="option-icon-nagad">Nagad</span>
                  <div class="flex-grow-1">
                    <div class="option-title">Nagad Digital Wallet</div>
                    <div class="option-subtitle">Seamless online payment via SSLCommerz Gateway.</div>
                  </div>
                </div>
              </div>

              <!-- Credit / Debit Card (Stripe) -->
              <div
                class="payment-option-card"
                :class="{ active: selectedPayment === 'card' }"
                @click="selectedPayment = 'card'"
              >
                <div class="option-header">
                  <div class="option-radio-icon"></div>
                  <span class="option-icon">💳</span>
                  <div class="flex-grow-1">
                    <div class="option-title">Credit / Debit Card (Stripe)</div>
                    <div class="option-subtitle">Visa, MasterCard, American Express with 3D-Secure protection.</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Error Banner -->
            <div v-if="errorMessage" class="alert alert-danger mt-3 mb-0 py-2 px-3 small rounded-3 d-flex align-items-center gap-2">
              <span>⚠️</span>
              <span>{{ errorMessage }}</span>
            </div>
          </div>
        </div>

        <!-- Right: Order Summary Sidebar -->
        <div class="glass-panel checkout-panel">
          <h3 class="panel-section-title">📦 Order Summary</h3>

          <div class="checkout-items-list mb-3">
            <div
              v-for="item in cartItems"
              :key="item.id || item.cart_item_id"
              class="checkout-item-row"
            >
              <div class="checkout-item-thumb">
                <img
                  :src="item.frame_catalog_image || item.image_url || item.frame_image_url || '/images/frames/placeholder.png'"
                  :alt="item.frame_name || item.name || 'Frame'"
                  class="img-fluid"
                />
              </div>
              <div class="flex-grow-1">
                <div class="small font-weight-700 text-white">{{ item.frame_name || item.name || 'Frame' }}</div>
                <div class="small text-muted-custom">
                  {{ item.quantity }} × ৳{{ Number(item.price ?? item.frame_price ?? item.unit_price ?? 0).toFixed(2) }}
                </div>
              </div>
              <div class="small font-weight-700 text-white">
                ৳{{ (Number(item.price ?? item.frame_price ?? item.unit_price ?? 0) * Number(item.quantity)).toFixed(2) }}
              </div>
            </div>
          </div>

          <div class="checkout-breakdown">
            <div class="d-flex justify-content-between mb-2 small text-white-50">
              <span>Subtotal ({{ totalItemCount }} items)</span>
              <span class="text-white font-weight-600">৳{{ subtotal.toFixed(2) }}</span>
            </div>

            <div class="d-flex justify-content-between mb-2 small text-white-50">
              <span>Delivery Fee</span>
              <span v-if="deliveryCharge === 0" class="badge bg-success-subtle text-success font-weight-700">FREE</span>
              <span v-else class="text-white font-weight-600">৳{{ deliveryCharge.toFixed(2) }}</span>
            </div>

            <!-- Free Delivery Progress Notice -->
            <div v-if="subtotal < 200 && subtotal > 0" class="mb-3 p-2 rounded-3 bg-dark bg-opacity-50 border border-secondary border-opacity-25 small text-white-50">
              <span>🚚 Orders over <strong>৳200.00</strong> get <strong>FREE Delivery</strong>! (Add ৳{{ (200 - subtotal).toFixed(2) }} more)</span>
            </div>
            <div v-else-if="subtotal >= 200" class="mb-3 p-2 rounded-3 bg-success bg-opacity-10 border border-success border-opacity-25 small text-success font-weight-600">
              <span>🎉 You qualify for <strong>FREE Delivery</strong>!</span>
            </div>

            <hr class="border-secondary border-opacity-25 my-3" />

            <div class="d-flex justify-content-between align-items-center mb-4">
              <span class="fs-6 font-weight-700 text-white">Total Amount</span>
              <span class="fs-5 font-weight-800 text-primary-custom">৳{{ totalAmount.toFixed(2) }}</span>
            </div>
          </div>

          <button
            type="submit"
            class="btn btn-primary btn-full rounded-pill py-3 font-weight-700 fs-6 d-flex align-items-center justify-content-center gap-2"
            :disabled="isSubmitting || cartItems.length === 0"
          >
            <span v-if="isSubmitting" class="spinner-border spinner-border-sm"></span>
            <span v-else>🔒</span>
            <span>{{ isSubmitting ? 'Processing Payment...' : 'Confirm & Place Order' }}</span>
          </button>

          <div class="cart-security-badge mt-3 text-center small text-white-50">
            <span>🛡️</span> SSL Encrypted • 100% Secure Checkout
          </div>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  user: {
    type: Object,
    default: () => ({})
  },
  cartItems: {
    type: Array,
    default: () => []
  },
  deliveryCharge: {
    type: Number,
    default: 0
  }
});

const recipientName = ref(props.user.full_name || props.user.name || '');
const contactNumber = ref(props.user.phone || '');
const deliveryAddress = ref(props.user.address || '');
const orderNote = ref('');
const selectedPayment = ref('cod');
const isSubmitting = ref(false);
const errorMessage = ref('');

const subtotal = computed(() => {
  return props.cartItems.reduce((acc, item) => {
    const price = Number(item.price ?? item.frame_price ?? item.unit_price ?? 0);
    const qty = Number(item.quantity || 1);
    return acc + (price * qty);
  }, 0);
});

const totalItemCount = computed(() => {
  return props.cartItems.reduce((acc, item) => acc + (Number(item.quantity) || 1), 0);
});

const deliveryCharge = computed(() => {
  if (props.cartItems.length === 0) return 0;
  return subtotal.value >= 200 ? 0 : 5.00;
});

const totalAmount = computed(() => {
  return subtotal.value + deliveryCharge.value;
});

async function handleSubmit() {
  if (isSubmitting.value) return;
  if (!deliveryAddress.value || !deliveryAddress.value.trim()) {
    errorMessage.value = 'Please provide a valid delivery address.';
    return;
  }
  if (!contactNumber.value || !contactNumber.value.trim()) {
    errorMessage.value = 'Please provide a contact phone number.';
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = '';

  try {
    const res = await fetch('/customer/checkout/place-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        recipientName: recipientName.value,
        deliveryAddress: deliveryAddress.value,
        contactNumber: contactNumber.value,
        orderNote: orderNote.value,
        paymentMethod: selectedPayment.value
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      if (data.requiresPayment && data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else if (data.orderId) {
        window.location.href = `/customer/order-tracking/${data.orderId}?placed=1`;
      } else {
        window.location.href = '/customer/my-orders';
      }
    } else {
      errorMessage.value = data.error || 'Failed to process checkout. Please try again.';
      isSubmitting.value = false;
    }
  } catch (err) {
    console.error('Checkout submit error:', err);
    errorMessage.value = 'Network error while connecting to payment service. Please try again.';
    isSubmitting.value = false;
  }
}
</script>
