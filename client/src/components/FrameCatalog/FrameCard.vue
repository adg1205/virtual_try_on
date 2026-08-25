<template>
  <article :class="['frame-card', 'glass-panel', { 'frame-card-oos': !frame.availability }]">
    <div class="frame-card-image-wrap">
      <a :href="`/customer/frame-details/${frame.id}`" :aria-label="`View ${frame.name} details`">
        <img
          :src="frame.image_url"
          :alt="frame.name"
          class="frame-card-img"
          @error="handleImgError"
        />
      </a>

      <span :class="['availability-badge', frame.availability ? 'badge-in-stock' : 'badge-out-of-stock']">
        <span class="badge-dot"></span>
        {{ frame.availability ? 'In Stock' : 'Out of Stock' }}
      </span>
    </div>

    <div class="frame-card-body">
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div>
          <h3 class="frame-card-title">
            <a :href="`/customer/frame-details/${frame.id}`" class="frame-card-details-link">{{ frame.name }}</a>
          </h3>
          <span class="frame-card-brand">{{ frame.brand }}</span>
        </div>
        <span class="frame-card-price">৳{{ Number(frame.price).toFixed(2) }}</span>
      </div>

      <div class="frame-card-tags" aria-label="Frame specifications">
        <span v-if="frame.shape" class="frame-tag tag-shape">Shape: {{ frame.shape }}</span>
        <span v-if="frame.color" class="frame-tag tag-color">Color: {{ frame.color }}</span>
        <span v-if="frame.material" class="frame-tag tag-material">Material: {{ frame.material }}</span>
        <span v-if="frame.size" class="frame-tag tag-size">Size: {{ frame.size }}</span>
      </div>

      <div class="frame-card-actions">
        <a :href="`/customer/virtual-try-on?frameId=${frame.id}`" class="btn btn-primary py-2 small">
          Try On
        </a>
        <a :href="`/customer/frame-details/${frame.id}`" class="btn btn-secondary py-2 small">
          Details
        </a>
        <button
          type="button"
          class="btn btn-secondary py-2 small wishlist-action-btn"
          :class="{ 'wishlist-action-active': isWishlisted }"
          :aria-pressed="isWishlisted"
          @click="$emit('toggle-wishlist', frame.id)"
        >
          {{ isWishlisted ? '♥ Saved to Wishlist' : '♡ Add to Wishlist' }}
        </button>
      </div>
    </div>
  </article>
</template>

<script setup>
defineProps({
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

function handleImgError(event) {
  event.target.src = 'https://placehold.co/320x200/1a1a2e/a78bfa?text=No+Image';
}
</script>
