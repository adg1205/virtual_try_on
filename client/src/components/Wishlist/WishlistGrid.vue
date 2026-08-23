<template>
  <div class="wishlist-root">
    <div v-if="items.length > 0" class="wishlist-grid">
      <div
        v-for="frame in items"
        :key="frame.id"
        :class="['wishlist-card', 'glass-panel', { 'wishlist-card-oos': !frame.availability }]"
      >
        <div class="wishlist-image-wrap">
          <img
            :src="frame.image_url"
            :alt="frame.name"
            class="wishlist-img"
            @error="handleImgError"
          />
          <span :class="['availability-badge', frame.availability ? 'badge-in-stock' : 'badge-out-of-stock']">
            ● {{ frame.availability ? 'In Stock' : 'Out of Stock' }}
          </span>
          <button
            type="button"
            class="wishlist-remove-btn"
            title="Remove from Wishlist"
            @click="handleRemove(frame.id)"
          >
            ✕
          </button>
        </div>

        <div class="wishlist-card-body">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div>
              <h4 class="wishlist-card-name">{{ frame.name }}</h4>
              <span class="wishlist-card-brand">{{ frame.brand }}</span>
            </div>
            <span class="wishlist-card-price">৳{{ Number(frame.price).toFixed(2) }}</span>
          </div>

          <div class="wishlist-card-tags">
            <span v-if="frame.shape" class="frame-tag tag-shape">🔷 {{ frame.shape }}</span>
            <span v-if="frame.material" class="frame-tag tag-material">💎 {{ frame.material }}</span>
            <span v-if="frame.color" class="frame-tag tag-color">🎨 {{ frame.color }}</span>
          </div>

          <div class="wishlist-card-actions">
            <a :href="`/customer/frame-details/${frame.id}`" class="btn btn-primary btn-full py-2 small">
              View Details
            </a>
            <a
              :href="`/customer/virtual-try-on?frameId=${frame.id}`"
              class="btn btn-secondary py-2 px-3 d-flex align-items-center justify-content-center"
              title="Try On Now"
            >
              📸
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty Wishlist State -->
    <div v-else class="glass-panel text-center py-5 rounded-4 mx-auto" style="max-width: 600px;">
      <div class="fs-1 mb-2">❤️</div>
      <h3 class="fs-4 text-white font-weight-700 mb-2">Your Wishlist is Empty</h3>
      <p class="small text-muted-custom mb-4" style="max-width: 420px; margin: 0 auto; line-height: 1.6;">
        You haven't saved any favorite eyewear yet. Browse our collections and save the frames you love!
      </p>
      <a href="/customer/frame-catalog" class="btn btn-primary rounded-pill px-4 py-2 font-weight-700 d-inline-flex align-items-center gap-2">
        <span>👓</span> Discover Frames
      </a>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  initialWishlist: {
    type: Array,
    default: () => []
  }
});

const items = ref([...props.initialWishlist]);

async function handleRemove(frameId) {
  items.value = items.value.filter(f => f.id !== frameId);
  try {
    await fetch('/customer/wishlist/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frameId })
    });
  } catch (err) {
    console.error('Failed to remove from wishlist:', err);
  }
}

function handleImgError(e) {
  e.target.src = 'https://placehold.co/320x200/1a1a2e/a78bfa?text=🕶️+No+Image';
}
</script>
