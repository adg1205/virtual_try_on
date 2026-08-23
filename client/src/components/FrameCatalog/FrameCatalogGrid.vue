<template>
  <div class="frame-catalog-root">
    <!-- Filter Controls -->
    <CatalogFilters
      v-model:search="searchQuery"
      v-model:selectedShape="selectedShape"
      v-model:selectedMaterial="selectedMaterial"
      v-model:selectedAvailability="selectedAvailability"
      v-model:sortBy="sortBy"
      :shapeOptions="availableShapes"
      :materialOptions="availableMaterials"
    />

    <!-- Frames Count & Active Filter Indicator -->
    <div class="d-flex justify-content-between align-items-center mb-3">
      <span class="small text-muted-custom">
        Showing <strong>{{ filteredFrames.length }}</strong> of {{ frames.length }} frames
      </span>
      <button
        v-if="hasActiveFilters"
        class="btn btn-link btn-sm text-info p-0 text-decoration-none small"
        @click="resetFilters"
      >
        ✕ Reset Filters
      </button>
    </div>

    <!-- Product Grid -->
    <div v-if="filteredFrames.length > 0" class="frame-catalog-grid">
      <FrameCard
        v-for="frame in filteredFrames"
        :key="frame.id"
        :frame="frame"
        :isWishlisted="isWishlisted(frame.id)"
        @toggle-wishlist="handleToggleWishlist"
      />
    </div>

    <!-- Empty State -->
    <div v-else class="glass-panel text-center py-5 rounded-4">
      <div class="fs-1 mb-2">🔍</div>
      <h3 class="fs-5 text-white font-weight-700 mb-1">No Matching Frames Found</h3>
      <p class="small text-muted-custom mb-3">
        Try adjusting your filters or search keywords.
      </p>
      <button class="btn btn-secondary btn-sm rounded-pill px-4" @click="resetFilters">
        Clear All Filters
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import CatalogFilters from './CatalogFilters.vue';
import FrameCard from './FrameCard.vue';
import { useWishlist } from '../../composables/useWishlist';

const props = defineProps({
  frames: {
    type: Array,
    default: () => []
  },
  wishlistIds: {
    type: Array,
    default: () => []
  },
  initialCategory: {
    type: String,
    default: ''
  }
});

const searchQuery = ref('');
const selectedShape = ref('');
const selectedMaterial = ref('');
const selectedAvailability = ref('');
const sortBy = ref('popular');

const { wishlistIds: activeWishlistIds, isWishlisted, toggleWishlist } = useWishlist(props.wishlistIds);

// Extract distinct available shapes & materials from provided frames
const availableShapes = computed(() => {
  const set = new Set();
  props.frames.forEach(f => { if (f.shape) set.add(f.shape); });
  return Array.from(set).sort();
});

const availableMaterials = computed(() => {
  const set = new Set();
  props.frames.forEach(f => { if (f.material) set.add(f.material); });
  return Array.from(set).sort();
});

const hasActiveFilters = computed(() => {
  return searchQuery.value.trim() !== '' ||
    selectedShape.value !== '' ||
    selectedMaterial.value !== '' ||
    selectedAvailability.value !== '' ||
    sortBy.value !== 'popular';
});

function resetFilters() {
  searchQuery.value = '';
  selectedShape.value = '';
  selectedMaterial.value = '';
  selectedAvailability.value = '';
  sortBy.value = 'popular';
}

function handleToggleWishlist(frameId) {
  toggleWishlist(frameId);
}

// Client-side instant filtering and sorting
const filteredFrames = computed(() => {
  let list = [...props.frames];

  // Search
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(f =>
      (f.name && f.name.toLowerCase().includes(q)) ||
      (f.brand && f.brand.toLowerCase().includes(q)) ||
      (f.shape && f.shape.toLowerCase().includes(q)) ||
      (f.color && f.color.toLowerCase().includes(q))
    );
  }

  // Shape
  if (selectedShape.value) {
    list = list.filter(f => f.shape && f.shape.toLowerCase() === selectedShape.value.toLowerCase());
  }

  // Material
  if (selectedMaterial.value) {
    list = list.filter(f => f.material && f.material.toLowerCase() === selectedMaterial.value.toLowerCase());
  }

  // Availability
  if (selectedAvailability.value === 'in-stock') {
    list = list.filter(f => Boolean(f.availability));
  } else if (selectedAvailability.value === 'out-of-stock') {
    list = list.filter(f => !f.availability);
  }

  // Sorting
  if (sortBy.value === 'price-asc') {
    list.sort((a, b) => Number(a.price) - Number(b.price));
  } else if (sortBy.value === 'price-desc') {
    list.sort((a, b) => Number(b.price) - Number(a.price));
  } else if (sortBy.value === 'name-asc') {
    list.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy.value === 'name-desc') {
    list.sort((a, b) => b.name.localeCompare(a.name));
  }

  return list;
});
</script>
