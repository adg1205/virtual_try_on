<template>
  <div class="tryon-history-root">
    <template v-if="historyItems.length">
      <div class="history-mobile-list d-lg-none">
        <article v-for="item in historyItems" :key="item.id" class="glass-panel history-card p-3 rounded-4">
          <img :src="imageFor(item)" :alt="`${item.frame_name} saved try-on`" class="history-thumb-img rounded-3" @error="handleImgError" />
          <div class="d-flex justify-content-between gap-3 mt-3">
            <div>
              <h3 class="fs-6 text-white mb-1">{{ item.frame_name }}</h3>
              <p class="small text-white-50 mb-0">{{ item.brand }} · {{ item.lens_option }}</p>
            </div>
            <time class="small text-white-50 text-nowrap">{{ formatDate(item.created_at) }}</time>
          </div>
          <div class="history-actions mt-3">
            <a :href="reuseUrl(item)" class="btn btn-primary btn-sm rounded-pill">Reuse look</a>
            <a :href="`/customer/frame-details/${item.frame_id}`" class="btn btn-secondary btn-sm rounded-pill">Frame details</a>
            <button type="button" class="btn btn-outline-danger btn-sm rounded-pill" :disabled="deletingId === item.id" @click="deleteSnapshot(item.id)">
              {{ deletingId === item.id ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </article>
      </div>

      <div class="history-desktop-table d-none d-lg-block glass-panel rounded-4 overflow-hidden">
        <div class="table-responsive">
          <table class="table table-dark table-borderless align-middle mb-0 history-table">
            <thead><tr><th>Saved look</th><th>Frame</th><th>Lens & fit</th><th>Saved</th><th class="text-end">Actions</th></tr></thead>
            <tbody>
              <tr v-for="item in historyItems" :key="item.id">
                <td><img :src="imageFor(item)" :alt="`${item.frame_name} saved try-on`" class="history-table-thumb rounded-3" @error="handleImgError" /></td>
                <td><strong>{{ item.frame_name }}</strong><small class="d-block text-white-50">{{ item.brand }}</small></td>
                <td><span>{{ item.lens_option }}</span><small class="d-block text-white-50">{{ fitSummary(item.overlay_settings) }}</small></td>
                <td>{{ formatDate(item.created_at) }}</td>
                <td>
                  <div class="d-flex justify-content-end gap-2">
                    <a :href="reuseUrl(item)" class="btn btn-primary btn-sm rounded-pill">Reuse</a>
                    <a :href="`/customer/frame-details/${item.frame_id}`" class="btn btn-secondary btn-sm rounded-pill">Details</a>
                    <button type="button" class="btn btn-outline-danger btn-sm rounded-pill" :disabled="deletingId === item.id" @click="deleteSnapshot(item.id)">Delete</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <div v-else class="glass-panel text-center py-5 rounded-4 mx-auto history-empty">
      <div class="fs-1 mb-2">📸</div>
      <h3 class="fs-4 text-white mb-2">No Try-On History Yet</h3>
      <p class="small text-white-50 mb-4">Adjust a frame in the virtual studio and save the final result here.</p>
      <a href="/customer/frame-catalog" class="btn btn-primary rounded-pill px-4">Explore frames</a>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({ initialHistory: { type: Array, default: () => [] } });
const historyItems = ref([...props.initialHistory]);
const deletingId = ref(null);

function imageFor(item) { return item.image_url || item.frame_catalog_image; }
function reuseUrl(item) { return `/customer/virtual-try-on?historyId=${encodeURIComponent(item.id)}`; }
function handleImgError(event) { event.target.src = 'https://placehold.co/400x300/1a1a2e/a78bfa?text=Saved+Try-On'; }
function fitSummary(settings = {}) {
  const scale = Math.round(Number(settings.scale || 1) * 100);
  const rotation = Math.round(Number(settings.rotation || 0));
  return `${scale}% size · ${rotation}° rotation`;
}

async function deleteSnapshot(id) {
  if (!window.confirm('Delete this saved try-on result?')) return;
  deletingId.value = id;
  try {
    const response = await fetch('/customer/tryon-history/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ historyId: id })
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Delete failed');
    historyItems.value = historyItems.value.filter(item => item.id !== id);
  } catch (error) {
    window.alert(error.message || 'Could not delete the saved result.');
  } finally {
    deletingId.value = null;
  }
}

function formatDate(value) {
  if (!value) return '';
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  return new Date(iso).toLocaleString('en-BD', { dateStyle: 'medium', timeStyle: 'short' });
}
</script>

<style scoped>
.history-mobile-list { display: grid; gap: 1rem; }
.history-thumb-img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; background: rgba(0, 0, 0, .35); }
.history-actions { display: flex; flex-wrap: wrap; gap: .5rem; }
.history-table { --bs-table-bg: transparent; }
.history-table thead { background: rgba(255, 255, 255, .05); }
.history-table th, .history-table td { padding: 1rem; border-bottom: 1px solid rgba(255, 255, 255, .08); }
.history-table-thumb { width: 112px; height: 76px; object-fit: cover; background: rgba(0, 0, 0, .35); }
.history-empty { max-width: 600px; }
@media (min-width: 768px) and (max-width: 991.98px) { .history-mobile-list { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
