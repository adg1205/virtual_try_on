<template>
  <div class="compare-matrix-root">
    <!-- Frame Picker Bar -->
    <div class="glass-panel p-3 rounded-4 mb-4">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
        <span class="small font-weight-700 text-uppercase text-muted-custom">Comparing {{ selectedFrames.length }} Frames</span>
        <span class="small text-info">Up to 3 frames side-by-side</span>
      </div>

      <div class="d-flex gap-2 flex-wrap">
        <div
          v-for="(slot, idx) in [0, 1, 2]"
          :key="idx"
          class="compare-slot-pill"
        >
          <span v-if="selectedFrames[idx]" class="badge bg-primary rounded-pill px-3 py-2">
            {{ selectedFrames[idx].name }}
            <button
              type="button"
              class="btn-close btn-close-white btn-sm ms-2"
              @click="removeSlot(idx)"
            ></button>
          </span>
          <select
            v-else
            class="form-select form-select-sm compare-picker-select"
            @change="addFrameToSlot(idx, $event.target.value)"
          >
            <option value="">+ Add Frame to Slot {{ idx + 1 }}</option>
            <option
              v-for="f in allFrames"
              :key="f.id"
              :value="f.id"
              :disabled="selectedFrames.some(sf => sf.id === f.id)"
            >
              {{ f.name }} ({{ f.brand }})
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Comparison Grid Table -->
    <div v-if="selectedFrames.length > 0" class="glass-panel p-3 rounded-4 overflow-x-auto">
      <table class="compare-table w-100">
        <thead>
          <tr>
            <th class="compare-th-spec" style="width: 200px;">Specification</th>
            <th
              v-for="frame in selectedFrames"
              :key="frame.id"
              class="compare-th-card text-center"
            >
              <div class="compare-col-header p-2">
                <div class="compare-col-thumb mx-auto mb-2">
                  <img :src="frame.image_url" :alt="frame.name" class="img-fluid" />
                </div>
                <h4 class="fs-6 font-weight-700 text-white mb-1">{{ frame.name }}</h4>
                <span class="small text-muted-custom">{{ frame.brand }}</span>
                <div class="mt-2 d-flex gap-1 justify-content-center">
                  <a :href="`/customer/frame-details/${frame.id}`" class="btn btn-primary btn-sm rounded-pill px-3">
                    Details
                  </a>
                  <a :href="`/customer/virtual-try-on?frameId=${frame.id}`" class="btn btn-secondary btn-sm rounded-pill px-2" title="Try On">
                    📸
                  </a>
                </div>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <!-- Try-On Preview -->
          <tr>
            <td class="compare-spec-name">Try-On Preview</td>
            <td v-for="frame in selectedFrames" :key="frame.id" class="text-center">
              <div v-if="tryOnFor(frame)" class="compare-tryon-cell">
                <img
                  :src="tryOnFor(frame).image_url"
                  :alt="`Your try-on of ${frame.name}`"
                  class="compare-tryon-img"
                  loading="lazy"
                />
                <span class="compare-tryon-meta">
                  {{ tryOnFor(frame).lens_option || 'Clear Lens' }}
                  <template v-if="tryOnFor(frame).created_at">
                    · {{ formatDate(tryOnFor(frame).created_at) }}
                  </template>
                </span>
              </div>
              <div v-else class="compare-tryon-cell compare-tryon-empty">
                <span class="compare-tryon-placeholder">📷</span>
                <a :href="`/customer/virtual-try-on?frameId=${frame.id}`" class="compare-tryon-cta">
                  Try this on to preview
                </a>
              </div>
            </td>
          </tr>

          <!-- Price -->
          <tr>
            <td class="compare-spec-name">Price</td>
            <td v-for="frame in selectedFrames" :key="frame.id" class="text-center font-weight-800 text-secondary-custom">
              ৳{{ Number(frame.price).toFixed(2) }}
            </td>
          </tr>

          <!-- Shape -->
          <tr>
            <td class="compare-spec-name">Frame Shape</td>
            <td v-for="frame in selectedFrames" :key="frame.id" class="text-center text-white">
              🔷 {{ frame.shape }}
            </td>
          </tr>

          <!-- Color -->
          <tr>
            <td class="compare-spec-name">Color</td>
            <td v-for="frame in selectedFrames" :key="frame.id" class="text-center text-white">
              🎨 {{ frame.color }}
            </td>
          </tr>

          <!-- Material -->
          <tr>
            <td class="compare-spec-name">Material</td>
            <td v-for="frame in selectedFrames" :key="frame.id" class="text-center text-white">
              💎 {{ frame.material }}
            </td>
          </tr>

          <!-- Size -->
          <tr>
            <td class="compare-spec-name">Size</td>
            <td v-for="frame in selectedFrames" :key="frame.id" class="text-center text-white">
              ↔ {{ frame.size || 'Medium' }}
            </td>
          </tr>

          <!-- Availability -->
          <tr>
            <td class="compare-spec-name">Stock Status</td>
            <td v-for="frame in selectedFrames" :key="frame.id" class="text-center">
              <span :class="['availability-badge', frame.availability ? 'badge-in-stock' : 'badge-out-of-stock']">
                ● {{ frame.availability ? 'In Stock' : 'Out of Stock' }}
              </span>
            </td>
          </tr>

          <!-- AI Style Suggestion -->
          <tr>
            <td class="compare-spec-name">AI Style Suggestion</td>
            <td v-for="frame in selectedFrames" :key="frame.id" class="compare-style-td">
              <div class="compare-style-cell">
                <template v-if="styleFor(frame).loading">
                  <span class="compare-style-loading">✨ Asking the AI stylist…</span>
                </template>
                <template v-else-if="styleFor(frame).text">
                  <p class="compare-style-text">{{ styleFor(frame).text }}</p>
                  <span v-if="styleFor(frame).source === 'fallback'" class="compare-style-source">
                    Offline stylist — set GEMINI_API_KEY for tailored advice
                  </span>
                </template>
                <template v-else>
                  <span class="compare-style-error">
                    Style suggestion unavailable.
                    <button type="button" class="compare-style-retry" @click="fetchStyleSuggestion(frame)">Retry</button>
                  </span>
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Empty State -->
    <div v-else class="glass-panel text-center py-5 rounded-4">
      <div class="fs-1 mb-2">⚖️</div>
      <h3 class="fs-5 text-white font-weight-700 mb-1">No Frames Selected for Comparison</h3>
      <p class="small text-muted-custom mb-3">Choose frames from above to compare their specifications and fit side-by-side.</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  initialFrames: {
    type: Array,
    default: () => []
  },
  allFrames: {
    type: Array,
    default: () => []
  },
  // Latest saved try-on capture per frame id, for the try-on preview row.
  tryOnPreviews: {
    type: Object,
    default: () => ({})
  }
});

const selectedFrames = ref([...props.initialFrames]);

// frame id -> { loading, text, source } for the AI style suggestion row.
const styleSuggestions = ref({});

const EMPTY_SUGGESTION = { loading: false, text: '', source: '' };

function tryOnFor(frame) {
  return props.tryOnPreviews[frame.id] || props.tryOnPreviews[String(frame.id)] || null;
}

function styleFor(frame) {
  return styleSuggestions.value[frame.id] || EMPTY_SUGGESTION;
}

function formatDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// The stylist is prompted with whatever the customer actually wore in their
// last try-on, so the advice matches the lens and colour they saw on screen.
async function fetchStyleSuggestion(frame) {
  const tryOn = tryOnFor(frame);
  styleSuggestions.value = {
    ...styleSuggestions.value,
    [frame.id]: { loading: true, text: '', source: '' }
  };

  try {
    const response = await fetch('/customer/ai-style-suggestion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        frameId: frame.id,
        color: tryOn?.color_option || frame.color,
        lensStyle: tryOn?.lens_option || 'Clear Lens',
        faceShape: tryOn?.face_shape || null
      })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to load style suggestion');
    }

    styleSuggestions.value = {
      ...styleSuggestions.value,
      [frame.id]: { loading: false, text: data.suggestion || '', source: data.source || '' }
    };
  } catch (err) {
    console.warn('Unable to load AI style suggestion:', err);
    styleSuggestions.value = {
      ...styleSuggestions.value,
      [frame.id]: { loading: false, text: '', source: '' }
    };
  }
}

function removeSlot(idx) {
  const [removed] = selectedFrames.value.splice(idx, 1);
  if (removed) {
    const { [removed.id]: _discarded, ...rest } = styleSuggestions.value;
    styleSuggestions.value = rest;
  }
}

async function addFrameToSlot(slotIdx, frameId) {
  if (!frameId) return;
  const frame = props.allFrames.find(f => String(f.id) === String(frameId));
  if (frame && !selectedFrames.value.some(sf => sf.id === frame.id)) {
    if (selectedFrames.value.length < 3) {
      const framesAlreadySelected = [...selectedFrames.value];
      selectedFrames.value.push(frame);

      // The stylist call is independent of comparison logging, so let it run
      // alongside rather than delaying the row behind analytics.
      fetchStyleSuggestion(frame);

      // Record every newly formed pair. With three selected frames, adding the
      // third frame creates two new comparison pairs; the first pair was
      // already recorded when the second frame was selected.
      await Promise.all(framesAlreadySelected.map(async (existingFrame) => {
        try {
          const response = await fetch('/customer/compare-data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              frameId1: existingFrame.id,
              frameId2: frame.id
            })
          });

          const data = await response.json();
          if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to record comparison');
          }
        } catch (err) {
          // Comparison remains usable even if analytics recording fails.
          console.warn('Unable to record frame comparison:', err);
        }
      }));
    }
  }
}

// Frames restored into the matrix on load still need their stylist row filled.
props.initialFrames.forEach(frame => fetchStyleSuggestion(frame));
</script>
