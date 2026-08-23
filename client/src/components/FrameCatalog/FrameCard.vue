<template>
  <div :class="['frame-card', 'glass-panel', { 'frame-card-oos': !frame.availability }]">
    <div class="frame-card-image-wrap">
      <img
        :src="frame.image_url"
        :alt="frame.name"
        class="frame-card-img"
        @error="handleImgError"
      />
      <button
        type="button"
        class="catalog-wishlist-btn"
        :class="{ 'text-danger': isWishlisted, 'text-white-50': !isWishlisted }"
        :title="isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'"
        @click.stop.prevent="$emit('toggle-wishlist', frame.id)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" :fill="isWishlisted ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2.5">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
        </svg>
      </button>

      <span :class="['availability-badge', frame.availability ? 'badge-in-stock' : 'badge-out-of-stock']">
        ● {{ frame.availability ? 'In Stock' : 'Out of Stock' }}
      </span>
    </div>

    <div class="frame-card-body">
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div>
          <h4 class="frame-card-title">{{ frame.name }}</h4>
          <span class="frame-card-brand">{{ frame.brand }}</span>
        </div>
        <span class="frame-card-price">৳{{ Number(frame.price).toFixed(2) }}</span>
      </div>

      <div class="frame-card-tags">
        <span v-if="frame.shape" class="frame-tag tag-shape">🔷 {{ frame.shape }}</span>
        <span v-if="frame.material" class="frame-tag tag-material">💎 {{ frame.material }}</span>
        <span v-if="frame.color" class="frame-tag tag-color">🎨 {{ frame.color }}</span>
      </div>

      <div class="frame-card-actions">
        <a :href="`/customer/frame-details/${frame.id}`" class="btn btn-primary btn-full py-2 small">
          Details
        </a>
        <a href="/customer/ai-recommendations" class="btn btn-secondary py-2 px-3 d-flex align-items-center justify-content-center" title="AI Facial Structure Analysis">
          📸
        </a>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  frame: {
    type: Object,
    required: true
  },
  isWishlisted: {
    type: Boolean,
    default: false
  }
});

defineEmits(['toggle-wishlist']);

function handleImgError(e) {
  e.target.src = 'https://placehold.co/320x200/1a1a2e/a78bfa?text=🕶️+No+Image';
}
</script>
