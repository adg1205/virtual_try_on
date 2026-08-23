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
    default: 'none'
  }
});

const emit = defineEmits(['tint-change']);

const tints = [
  { id: 'none', name: 'Clear / None', colorHex: 'rgba(255,255,255,0.08)', overlay: 'transparent', icon: '⚪' },
  { id: 'smoke-grey', name: 'Smoke Grey', colorHex: 'rgba(40,40,40,0.85)', overlay: 'rgba(30,30,30,0.4)', icon: '🕶️' },
  { id: 'ocean-blue', name: 'Ocean Blue', colorHex: 'rgba(30,120,255,0.8)', overlay: 'rgba(14,165,233,0.3)', icon: '🌊' },
  { id: 'rose-gold', name: 'Rose Gold', colorHex: 'rgba(230,120,150,0.8)', overlay: 'rgba(244,114,182,0.3)', icon: '🌸' },
  { id: 'amber-gold', name: 'Amber Gold', colorHex: 'rgba(217,119,6,0.85)', overlay: 'rgba(245,158,11,0.35)', icon: '☀️' },
  { id: 'emerald-green', name: 'Emerald Green', colorHex: 'rgba(16,185,129,0.85)', overlay: 'rgba(16,185,129,0.3)', icon: '🌿' }
];

const activeTintId = ref(props.initialTintId);

function selectTint(tint) {
  activeTintId.value = tint.id;
  emit('tint-change', tint);
}
</script>
