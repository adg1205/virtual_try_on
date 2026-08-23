import { ref } from 'vue';

export function useWishlist(initialWishlistIds = []) {
  const wishlistIds = ref(new Set(initialWishlistIds.map(id => String(id))));
  const isUpdating = ref(false);

  function isWishlisted(frameId) {
    return wishlistIds.value.has(String(frameId));
  }

  async function toggleWishlist(frameId) {
    const idStr = String(frameId);
    const currentlyWishlisted = wishlistIds.value.has(idStr);
    const endpoint = currentlyWishlisted ? '/customer/wishlist/remove' : '/customer/wishlist/add';

    // Optimistic update
    const newSet = new Set(wishlistIds.value);
    if (currentlyWishlisted) {
      newSet.delete(idStr);
    } else {
      newSet.add(idStr);
    }
    wishlistIds.value = newSet;

    isUpdating.value = true;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frameId: Number(frameId) })
      });
      const data = await res.json();
      if (!data.success) {
        // Revert on failure
        const revertedSet = new Set(wishlistIds.value);
        if (currentlyWishlisted) {
          revertedSet.add(idStr);
        } else {
          revertedSet.delete(idStr);
        }
        wishlistIds.value = revertedSet;
      }
      return data;
    } catch (err) {
      console.error('Wishlist toggle error:', err);
      // Revert on error
      const revertedSet = new Set(wishlistIds.value);
      if (currentlyWishlisted) {
        revertedSet.add(idStr);
      } else {
        revertedSet.delete(idStr);
      }
      wishlistIds.value = revertedSet;
      return { success: false, error: err.message };
    } finally {
      isUpdating.value = false;
    }
  }

  return {
    wishlistIds,
    isUpdating,
    isWishlisted,
    toggleWishlist,
  };
}
