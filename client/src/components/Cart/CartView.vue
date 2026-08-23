<template>
  <div class="cart-view-root">
    <div v-if="items.length > 0" class="cart-layout-grid">
      <!-- Left: Cart Items List -->
      <div class="glass-panel cart-items-panel">
        <div class="cart-table-header d-none d-md-flex">
          <div style="flex: 2;">Item</div>
          <div style="flex: 1; text-align: center;">Price</div>
          <div style="flex: 1; text-align: center;">Quantity</div>
          <div style="flex: 1; text-align: right;">Total</div>
          <div style="width: 40px;"></div>
        </div>

        <div class="cart-items-list">
          <CartItemRow
            v-for="item in items"
            :key="item.id || item.cart_item_id"
            :item="item"
            :disabled="isUpdating"
            @update-qty="handleUpdateQty"
            @remove-item="handleRemoveItem"
          />
        </div>
      </div>

      <!-- Right: Summary Sidebar -->
      <div class="cart-sidebar">
        <CartSummary
          :subtotal="subtotal"
          :deliveryCharge="deliveryCharge"
          :discount="appliedDiscount"
          :total="totalAmount"
          :totalItems="totalItemCount"
        />
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="glass-panel text-center py-5 rounded-4 mx-auto" style="max-width: 600px;">
      <div class="fs-1 mb-2">🛒</div>
      <h3 class="fs-4 text-white font-weight-700 mb-2">Your Shopping Cart is Empty</h3>
      <p class="small text-muted-custom mb-4" style="max-width: 420px; margin: 0 auto; line-height: 1.6;">
        Looks like you haven't added any frames to your cart yet. Discover stylish frames and try them on right now!
      </p>
      <a href="/customer/frame-catalog" class="btn btn-primary rounded-pill px-4 py-2 font-weight-700 d-inline-flex align-items-center gap-2">
        <span>👓</span> Explore Catalog
      </a>
    </div>
  </div>
</template>

<script setup>
import { useCart } from '../../composables/useCart';
import CartItemRow from './CartItemRow.vue';
import CartSummary from './CartSummary.vue';

const props = defineProps({
  cartItems: {
    type: Array,
    default: () => []
  },
  discount: {
    type: Number,
    default: 0
  }
});

const {
  items,
  appliedDiscount,
  isUpdating,
  subtotal,
  deliveryCharge,
  totalAmount,
  totalItemCount,
  updateQuantity,
  removeItem
} = useCart(props.cartItems, props.discount);

function handleUpdateQty(id, newQty) {
  updateQuantity(id, newQty);
}

function handleRemoveItem(id) {
  removeItem(id);
}
</script>
