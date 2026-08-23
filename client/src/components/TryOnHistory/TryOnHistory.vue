<template>
  <div class="tryon-history-root">
    <div v-if="historyItems.length > 0" class="history-grid">
      <div
        v-for="item in historyItems"
        :key="item.id"
        class="glass-panel history-card p-3 rounded-4"
      >
        <div class="history-thumb-wrap mb-3 position-relative rounded-3 overflow-hidden">
          <img
            :src="item.image_url || item.snapshot_image || item.snapshot_url || item.frame_catalog_image"
            :alt="`${item.frame_name} Try-On Snapshot`"
            class="history-thumb-img"
            @error="handleImgError"
          />
          <span v-if="item.face_shape || item.detected_face_shape" class="history-shape-pill position-absolute top-0 start-0 m-2 badge rounded-pill px-2 py-1 small">
            📐 {{ item.face_shape || item.detected_face_shape }} Face
          </span>
          <span v-if="item.lens_option && item.lens_option !== 'Clear Standard' && item.lens_option !== 'Clear Lens'" class="position-absolute bottom-0 end-0 m-2 badge bg-dark bg-opacity-75 rounded-pill px-2 py-1 small text-info border border-info border-opacity-25">
            👁️ {{ item.lens_option }}
          </span>
        </div>

        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>
            <h4 class="fs-6 font-weight-700 text-white mb-0">{{ item.frame_name }}</h4>
            <span class="small text-muted-custom">{{ item.brand || 'Optical Collection' }}</span>
          </div>
          <span class="small text-white-50">{{ formatDate(item.created_at) }}</span>
        </div>

        <div class="d-flex gap-2 pt-2 border-top border-secondary border-opacity-25">
          <a :href="`/customer/virtual-try-on?frameId=${item.frame_id}`" class="btn btn-primary btn-sm flex-grow-1 rounded-pill">
            📸 Re-Try Look
          </a>
          <a :href="`/customer/frame-details/${item.frame_id}`" class="btn btn-secondary btn-sm rounded-pill px-3" title="View Frame">
            👓
          </a>
          <button
            type="button"
            class="btn btn-danger btn-sm rounded-pill px-3"
            title="Delete Snapshot"
            @click="deleteSnapshot(item.id)"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>

    <!-- Empty History State -->
    <div v-else class="glass-panel text-center py-5 rounded-4 mx-auto" style="max-width: 600px;">
      <div class="fs-1 mb-2">📸</div>
      <h3 class="fs-4 text-white font-weight-700 mb-2">No Try-On History Yet</h3>
      <p class="small text-muted-custom mb-4" style="max-width: 420px; margin: 0 auto; line-height: 1.6;">
        Try on frames using your camera or photo upload and save snapshots to compare how they look on your face!
      </p>
      <a href="/customer/frame-catalog" class="btn btn-primary rounded-pill px-4 py-2 font-weight-700 d-inline-flex align-items-center gap-2">
        <span>👓</span> Explore Catalog & Try On
      </a>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  initialHistory: {
    type: Array,
    default: () => []
  }
});

const historyItems = ref([...props.initialHistory]);

function handleImgError(e) {
  e.target.src = 'https://placehold.co/400x300/1a1a2e/a78bfa?text=📸+Try-On+Snapshot';
}

async function deleteSnapshot(id) {
  if (!confirm('Are you sure you want to delete this saved snapshot?')) return;

  historyItems.value = historyItems.value.filter(item => item.id !== id);
  try {
    const res = await fetch('/customer/tryon-history/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ historyId: id })
    });
    const data = await res.json();
    if (!data.success) {
      console.warn('Delete response failed:', data);
    }
  } catch (err) {
    console.error('Failed to delete history item:', err);
  }
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr.includes('T') ? isoStr : isoStr.replace(' ', 'T') + (isoStr.includes('Z') ? '' : 'Z'));
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}
</script>

<style scoped>
.history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.history-card {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.history-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.45);
}

.history-thumb-wrap {
  width: 100%;
  height: 220px;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.history-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center center;
  transition: transform 0.4s ease;
}

.history-card:hover .history-thumb-img {
  transform: scale(1.05);
}

.history-shape-pill {
  background: rgba(124, 58, 237, 0.85);
  border: 1px solid rgba(167, 139, 250, 0.4);
  backdrop-filter: blur(6px);
}
</style>
