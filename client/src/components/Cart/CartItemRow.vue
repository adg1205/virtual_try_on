<template>
  <div class="cart-item-row">
    <!-- Image -->
    <div class="cart-item-thumb">
      <img
        :src="item.frame_catalog_image || item.image_url || item.frame_image_url || '/images/frames/placeholder.png'"
        :alt="item.frame_name || item.name || 'Frame'"
        class="img-fluid"
      />
    </div>

    <!-- Details -->
    <div class="cart-item-info">
      <h4 class="cart-item-name">{{ item.frame_name || item.name || 'Frame' }}</h4>
      <p class="cart-item-brand">{{ item.brand || item.frame_brand || '' }}</p>
      
      <div v-if="item.lens_option || item.selected_variant" class="cart-item-lens-chip">
        <span v-if="item.selected_variant" class="me-2">🎨 {{ item.selected_variant }}</span>
        <span v-if="item.lens_option">👁️ {{ item.lens_option }}</span>
      </div>
    </div>

    <!-- Unit Price -->
    <div class="cart-item-price-unit">
      ৳{{ unitPrice.toFixed(2) }}
    </div>

    <!-- Stepper -->
    <div class="cart-item-stepper-wrap">
      <QuantityStepper
        :quantity="Number(item.quantity)"
        :disabled="disabled"
        @update="$emit('update-qty', item.id || item.cart_item_id, $event)"
      />
    </div>

    <!-- Subtotal for this Item -->
    <div class="cart-item-total">
      ৳{{ (unitPrice * Number(item.quantity)).toFixed(2) }}
    </div>

    <!-- Remove -->
    <button
      type="button"
      class="cart-item-remove-btn"
      :disabled="disabled"
      title="Remove from Cart"
      @click="$emit('remove-item', item.id || item.cart_item_id)"
    >
      🗑️
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import QuantityStepper from './QuantityStepper.vue';

const props = defineProps({
  item: { type: Object, required: true },
  disabled: { type: Boolean, default: false }
});

defineEmits(['update-qty', 'remove-item']);

const unitPrice = computed(() => {
  return Number(props.item.price ?? props.item.frame_price ?? props.item.unit_price ?? 0);
});
</script>
