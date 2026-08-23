<template>
  <div class="glass-panel filter-panel p-3 rounded-4 mb-4">
    <div class="row g-2 align-items-center">
      <!-- Search Input -->
      <div class="col-12 col-md-4">
        <div class="catalog-search-wrap">
          <input
            type="text"
            :value="search"
            class="form-control form-control-sm catalog-filter-input"
            placeholder="🔍 Search frame name or brand..."
            @input="$emit('update:search', $event.target.value)"
          />
        </div>
      </div>

      <!-- Shape Filter -->
      <div class="col-6 col-md-2">
        <select
          :value="selectedShape"
          class="form-select form-select-sm catalog-filter-select"
          @change="$emit('update:selectedShape', $event.target.value)"
        >
          <option value="">All Shapes</option>
          <option v-for="s in shapeOptions" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>

      <!-- Material Filter -->
      <div class="col-6 col-md-2">
        <select
          :value="selectedMaterial"
          class="form-select form-select-sm catalog-filter-select"
          @change="$emit('update:selectedMaterial', $event.target.value)"
        >
          <option value="">All Materials</option>
          <option v-for="m in materialOptions" :key="m" :value="m">{{ m }}</option>
        </select>
      </div>

      <!-- Availability Filter -->
      <div class="col-6 col-md-2">
        <select
          :value="selectedAvailability"
          class="form-select form-select-sm catalog-filter-select"
          @change="$emit('update:selectedAvailability', $event.target.value)"
        >
          <option value="">All Stock</option>
          <option value="in-stock">In Stock</option>
          <option value="out-of-stock">Out of Stock</option>
        </select>
      </div>

      <!-- Sort By -->
      <div class="col-6 col-md-2">
        <select
          :value="sortBy"
          class="form-select form-select-sm catalog-filter-select"
          @change="$emit('update:sortBy', $event.target.value)"
        >
          <option value="popular">Popular</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
          <option value="name-asc">Name: A to Z</option>
          <option value="name-desc">Name: Z to A</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  search: { type: String, default: '' },
  selectedShape: { type: String, default: '' },
  selectedMaterial: { type: String, default: '' },
  selectedAvailability: { type: String, default: '' },
  sortBy: { type: String, default: 'popular' },
  shapeOptions: { type: Array, default: () => ['Round', 'Square', 'Oval', 'Aviator', 'Cat-Eye', 'Rectangle', 'Browline', 'Geometric'] },
  materialOptions: { type: Array, default: () => ['Acetate', 'Metal', 'Titanium', 'TR90', 'Plastic', 'Wood'] }
});

defineEmits([
  'update:search',
  'update:selectedShape',
  'update:selectedMaterial',
  'update:selectedAvailability',
  'update:sortBy'
]);
</script>
