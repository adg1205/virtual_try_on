<template>
  <div class="cart-qty-stepper">
    <button
      type="button"
      class="qty-btn"
      :disabled="quantity <= 1 || disabled"
      title="Decrease Quantity"
      @click="$emit('update', quantity - 1)"
    >
      −
    </button>
    <span class="qty-val">{{ quantity }}</span>
    <button
      type="button"
      class="qty-btn"
      :disabled="quantity >= 10 || disabled"
      title="Increase Quantity"
      @click="$emit('update', quantity + 1)"
    >
      +
    </button>
  </div>
</template>

<script setup>
defineProps({
  quantity: { type: Number, required: true },
  disabled: { type: Boolean, default: false }
});

defineEmits(['update']);
</script>
