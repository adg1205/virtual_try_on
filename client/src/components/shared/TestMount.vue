<template>
  <div class="vue-island-mounted p-3 rounded-3" style="background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(167, 139, 250, 0.4);">
    <div class="d-flex align-items-center gap-2">
      <span class="fs-4">⚡</span>
      <div>
        <h6 class="mb-0 text-white font-weight-bold">{{ title || 'Vue 3 Island Mounted Successfully' }}</h6>
        <small class="text-muted">{{ subtitle || 'Interactive frontend foundation is active' }}</small>
      </div>
    </div>
    <div v-if="counterEnabled" class="mt-2 d-flex align-items-center gap-2">
      <button class="btn btn-sm btn-primary px-3 py-1" @click="count++">
        Interactivity Test: {{ count }}
      </button>
      <span class="text-muted small">Reactive click state verified</span>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  subtitle: {
    type: String,
    default: ''
  },
  counterEnabled: {
    type: Boolean,
    default: true
  }
});

const count = ref(0);
</script>

<style scoped>
.vue-island-mounted {
  backdrop-filter: blur(12px);
  transition: all 0.3s ease;
}
</style>
