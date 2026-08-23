<template>
  <span :class="['availability-badge', inStock ? 'badge-in-stock' : 'badge-out-of-stock']">
    ● {{ inStock ? 'In Stock' : 'Out of Stock' }}
  </span>
</template>

<script setup>
defineProps({
  inStock: {
    type: Boolean,
    default: true
  }
});
</script>
