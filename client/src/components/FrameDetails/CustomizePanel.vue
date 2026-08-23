<template>
  <div class="glass-panel fd-customizer-panel p-4 rounded-4">
    <h3 class="panel-section-title">
      🎨 Customize & Order
    </h3>

    <form
      id="frame-customization-form"
      action="/customer/cart/add"
      method="POST"
      class="d-flex flex-column gap-3"
      @submit.prevent="handleAddToCart"
    >
      <input type="hidden" name="frameId" :value="frame.id" />

      <!-- Frame Color Variant -->
      <div>
        <label class="fd-spec-label mb-1 d-block">Frame Color</label>
        <select
          v-model="selectedColor"
          name="selected_variant"
          class="form-select fd-select"
          @change="onCustomizationChange"
        >
          <option :value="frame.color">{{ frame.color }} (Default)</option>
          <option v-if="frame.color !== 'Matte Black'" value="Matte Black">Matte Black</option>
          <option v-if="frame.color !== 'Tortoise'" value="Tortoise">Tortoise</option>
          <option v-if="frame.color !== 'Gold'" value="Gold">Gold</option>
          <option v-if="frame.color !== 'Silver'" value="Silver">Silver</option>
        </select>
      </div>

      <!-- Lens Option Selection -->
      <div>
        <label class="fd-spec-label mb-1 d-block">Lens Type</label>
        <select
          v-model="selectedLens"
          name="lens_option"
          class="form-select fd-select"
          :disabled="isFixedSportLens"
          @change="onCustomizationChange"
        >
          <option value="Clear Lens">Clear Lens</option>
          <option value="Blue-Light Lens">Blue-Light Lens</option>
          <option value="Gray Tint">Gray Tint</option>
          <option value="Brown Tint">Brown Tint</option>
          <option value="Sunglass Tint">Sunglass Tint</option>
        </select>
        <span v-if="isFixedSportLens" class="small text-muted-custom d-block mt-1">
          This sport-wrap frame uses its fixed sunglass lens.
        </span>
      </div>

      <!-- Lens Tint Swatches Component -->
      <LensTintSwatches
        :initialTintId="isFixedSportLens ? 'sunglass' : 'clear'"
        :disabled="isFixedSportLens"
        @tint-change="handleTintChange"
      />

      <div>
        <label class="fd-spec-label mb-1 d-block">Quantity</label>
        <select v-model.number="quantity" name="quantity" class="form-select fd-select">
          <option v-for="value in 10" :key="value" :value="value">{{ value }}</option>
        </select>
      </div>

      <!-- AI Stylist Suggestion Box -->
      <div class="fd-ai-box">
        <div class="d-flex align-items-center gap-2 mb-1">
          <span>✨</span>
          <span class="small font-weight-700 text-info">AI Optical Pairing</span>
        </div>
        <p class="small text-white-50 mb-0 fst-italic">
          {{ aiSuggestionText }}
        </p>
      </div>

      <!-- Action Buttons -->
      <div class="d-flex gap-2 pt-2">
        <button
          type="submit"
          class="btn btn-primary flex-grow-1 py-3 font-weight-700 rounded-pill d-flex align-items-center justify-content-center gap-2"
          :disabled="!frame.availability || isAdding"
        >
          <span>🛒</span>
          <span v-if="isAdding">Adding to Cart...</span>
          <span v-else-if="addSuccess">Added! Going to Cart...</span>
          <span v-else>{{ frame.availability ? 'Add to Cart' : 'Out of Stock' }}</span>
        </button>

        <a
          :href="`/customer/virtual-try-on?frameId=${frame.id}&color=${encodeURIComponent(selectedColor)}&lens=${encodeURIComponent(selectedLens)}`"
          class="btn btn-secondary rounded-pill px-3 d-flex align-items-center justify-content-center"
          title="Try on with this style"
        >
          📸 Try On
        </a>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import LensTintSwatches from './LensTintSwatches.vue';

const props = defineProps({
  frame: {
    type: Object,
    required: true
  },
  isFixedSportLens: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['tint-change', 'style-change']);

const selectedColor = ref(props.frame.color || 'Matte Black');
const selectedLens = ref(props.isFixedSportLens ? 'Sunglass Tint' : 'Clear Lens');
const quantity = ref(1);
const isAdding = ref(false);
const addSuccess = ref(false);

const aiSuggestionText = computed(() => {
  if (selectedLens.value === 'Blue-Light Lens') {
    return `Great choice for screen work! ${props.frame.shape} frame in ${selectedColor.value} provides optimal eye coverage with blue light filtering.`;
  } else if (selectedLens.value === 'Gray Tint') {
    return `The neutral gray tint reduces brightness without overwhelming the ${selectedColor.value} frame finish.`;
  } else if (selectedLens.value === 'Brown Tint') {
    return `A warm brown tint adds contrast and pairs naturally with the ${props.frame.material} construction.`;
  } else if (selectedLens.value === 'Sunglass Tint') {
    return `The deep sunglass tint gives ${props.frame.name} confident outdoor styling and strong sun comfort.`;
  }
  return `Classic pairing! The ${selectedColor.value} finish beautifully complements ${props.frame.shape} geometric aesthetics.`;
});

function onCustomizationChange() {
  emit('style-change', {
    color: selectedColor.value,
    lens: selectedLens.value
  });
}

function handleTintChange(tint) {
  selectedLens.value = tint.name;
  onCustomizationChange();
  emit('tint-change', tint);
}

async function handleAddToCart() {
  if (!props.frame.availability || isAdding.value) return;

  isAdding.value = true;
  try {
    const res = await fetch('/customer/cart/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        frameId: props.frame.id,
        selectedVariant: selectedColor.value,
        lensOption: selectedLens.value,
        quantity: quantity.value
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      addSuccess.value = true;
      setTimeout(() => {
        window.location.href = '/customer/cart';
      }, 500);
    } else {
      alert(data.error || 'Failed to add item to cart');
    }
  } catch (err) {
    console.error('Error adding to cart:', err);
    // Fallback: standard navigation
    window.location.href = '/customer/cart';
  } finally {
    isAdding.value = false;
  }
}
</script>
