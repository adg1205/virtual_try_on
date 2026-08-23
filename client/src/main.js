import { createApp } from 'vue';

// Shared Components
import TestMount from './components/shared/TestMount.vue';
import GlassPanel from './components/shared/GlassPanel.vue';
import StatusBadge from './components/shared/StatusBadge.vue';
import EmptyState from './components/shared/EmptyState.vue';

// Feature Island Components
import FrameCatalogGrid from './components/FrameCatalog/FrameCatalogGrid.vue';
import CartView from './components/Cart/CartView.vue';
import WishlistGrid from './components/Wishlist/WishlistGrid.vue';
import VirtualTryOn from './components/VirtualTryOn/VirtualTryOn.vue';
import CustomizePanel from './components/FrameDetails/CustomizePanel.vue';
import CheckoutForm from './components/Checkout/CheckoutForm.vue';
import CompareMatrix from './components/Compare/CompareMatrix.vue';
import TryOnHistory from './components/TryOnHistory/TryOnHistory.vue';
import AiRecommendations from './components/AiRecommendations/AiRecommendations.vue';

const componentRegistry = {
  TestMount,
  GlassPanel,
  StatusBadge,
  EmptyState,
  FrameCatalogGrid,
  CartView,
  WishlistGrid,
  VirtualTryOn,
  CustomizePanel,
  CheckoutForm,
  CompareMatrix,
  TryOnHistory,
  AiRecommendations,
};

/**
 * Register an additional component dynamically
 * @param {string} name 
 * @param {import('vue').Component} component 
 */
export function registerVueComponent(name, component) {
  componentRegistry[name] = component;
}

/**
 * Scan DOM and mount Vue components to matching [data-vue-component] elements
 * @param {Document|HTMLElement} root 
 */
export function initVueIslands(root = document) {
  const elements = root.querySelectorAll('[data-vue-component]');
  
  elements.forEach((el) => {
    // Avoid double mounting
    if (el.__vue_app__) return;

    const componentName = el.getAttribute('data-vue-component');
    const component = componentRegistry[componentName];

    if (!component) {
      console.warn(`[Vue Islands] Component "${componentName}" is not registered in componentRegistry.`);
      return;
    }

    let props = {};
    const rawProps = el.getAttribute('data-vue-props');
    if (rawProps) {
      try {
        props = JSON.parse(rawProps);
      } catch (err) {
        console.error(`[Vue Islands] Failed to parse props for "${componentName}":`, err, rawProps);
      }
    }

    try {
      const app = createApp(component, props);
      app.mount(el);
      el.__vue_app__ = app;
      console.log(`[Vue Islands] Mounted "${componentName}" successfully`);
    } catch (mountErr) {
      console.error(`[Vue Islands] Error mounting "${componentName}":`, mountErr);
    }
  });
}

// Automatically initialize when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initVueIslands(document));
  } else {
    initVueIslands(document);
  }
}
