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

          <!-- Material -->
          <tr>
            <td class="compare-spec-name">Material</td>
            <td v-for="frame in selectedFrames" :key="frame.id" class="text-center text-white">
              💎 {{ frame.material }}
            </td>
          </tr>

          <!-- Color -->
          <tr>
            <td class="compare-spec-name">Color</td>
            <td v-for="frame in selectedFrames" :key="frame.id" class="text-center text-white">
              🎨 {{ frame.color }}
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
  }
});

const selectedFrames = ref([...props.initialFrames]);

function removeSlot(idx) {
  selectedFrames.value.splice(idx, 1);
}

async function addFrameToSlot(slotIdx, frameId) {
  if (!frameId) return;
  const frame = props.allFrames.find(f => String(f.id) === String(frameId));
  if (frame && !selectedFrames.value.some(sf => sf.id === frame.id)) {
    if (selectedFrames.value.length < 3) {
      const framesAlreadySelected = [...selectedFrames.value];
      selectedFrames.value.push(frame);

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
</script>
