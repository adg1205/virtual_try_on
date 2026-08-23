<template>
  <div class="empty-state-box">
    <div class="empty-state-icon">{{ icon }}</div>
    <h3 class="empty-state-title">{{ title }}</h3>
    <p class="empty-state-desc">{{ message }}</p>
    <a v-if="actionLink && actionText" :href="actionLink" class="btn btn-primary rounded-pill px-4 py-2 font-weight-700">
      {{ actionText }}
    </a>
  </div>
</template>

<script setup>
defineProps({
  icon: { type: String, default: '📦' },
  title: { type: String, default: 'No Items Found' },
  message: { type: String, default: '' },
  actionLink: { type: String, default: '' },
  actionText: { type: String, default: '' }
});
</script>
