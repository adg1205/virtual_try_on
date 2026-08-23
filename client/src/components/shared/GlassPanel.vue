<template>
  <div :class="['glass-panel', customClass]">
    <slot></slot>
  </div>
</template>

<script setup>
defineProps({
  customClass: {
    type: String,
    default: ''
  }
});
</script>
