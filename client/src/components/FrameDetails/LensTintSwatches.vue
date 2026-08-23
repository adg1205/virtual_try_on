<template>
  <div class="lens-tint-swatches-wrap">
    <label class="fd-spec-label mb-2 d-block">Lens Tint Filter</label>
    <div class="lens-tint-swatches">
      <button
        v-for="tint in tints"
        :key="tint.id"
        type="button"
        :class="['tint-swatch', { active: activeTintId === tint.id }]"
        :style="{ background: tint.colorHex }"
        :title="tint.name"
        :disabled="disabled"
        @click="selectTint(tint)"
      >
        <span class="swatch-icon">{{ tint.icon }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  initialTintId: {
    type: String,
    default: 'clear'
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['tint-change']);

const tints = [
  { id: 'clear', name: 'Clear Lens', colorHex: 'rgba(255,255,255,0.08)', overlay: 'transparent', icon: '⚪' },
  { id: 'blue-light', name: 'Blue-Light Lens', colorHex: 'rgba(135,196,222,0.55)', overlay: 'rgba(135,196,222,0.09)', icon: '💻' },
  { id: 'gray', name: 'Gray Tint', colorHex: 'rgba(65,69,74,0.88)', overlay: 'rgba(65,69,74,0.38)', icon: '🕶️' },
  { id: 'brown', name: 'Brown Tint', colorHex: 'rgba(109,74,43,0.90)', overlay: 'rgba(109,74,43,0.40)', icon: '🟤' },
  { id: 'sunglass', name: 'Sunglass Tint', colorHex: 'rgba(18,22,26,0.98)', overlay: 'rgba(18,22,26,0.72)', icon: '☀️' }
];

const activeTintId = ref(props.initialTintId);

function selectTint(tint) {
  if (props.disabled) return;
  activeTintId.value = tint.id;
  emit('tint-change', tint);
}
</script>
