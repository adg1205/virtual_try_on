import { ref, computed } from 'vue';

export function useCart(initialItems = [], initialDiscount = 0) {
  const items = ref([...initialItems]);
  const appliedDiscount = ref(Number(initialDiscount) || 0);
  const isUpdating = ref(false);

  const subtotal = computed(() => {
    return items.value.reduce((acc, item) => {
      const price = Number(item.price ?? item.frame_price ?? item.unit_price ?? 0);
      const qty = Number(item.quantity || 1);
      return acc + (price * qty);
    }, 0);
  });

  const deliveryCharge = computed(() => {
    if (items.value.length === 0) return 0;
    return subtotal.value >= 200.00 ? 0 : 5.00;
  });

  const totalAmount = computed(() => {
    const total = subtotal.value + deliveryCharge.value - appliedDiscount.value;
    return total > 0 ? total : 0;
  });

  const totalItemCount = computed(() => {
    return items.value.reduce((acc, item) => acc + (Number(item.quantity) || 1), 0);
  });

  async function updateQuantity(cartItemId, newQuantity) {
    if (newQuantity < 1 || newQuantity > 10) return;
    const targetId = Number(cartItemId);
    const item = items.value.find(i => Number(i.id) === targetId || Number(i.cart_item_id) === targetId);
    if (!item) return;

    const oldQty = item.quantity;
    item.quantity = newQuantity;

    isUpdating.value = true;
    try {
      const res = await fetch('/customer/cart/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartId: targetId,
          cartItemId: targetId,
          quantity: newQuantity
        })
      });
      const data = await res.json();
      if (!data.success) {
        item.quantity = oldQty;
      }
      return data;
    } catch (err) {
      console.error('Cart update error:', err);
      item.quantity = oldQty;
      return { success: false, error: err.message };
    } finally {
      isUpdating.value = false;
    }
  }

  async function removeItem(cartItemId) {
    const targetId = Number(cartItemId);
    const prevItems = [...items.value];
    items.value = items.value.filter(i => Number(i.id) !== targetId && Number(i.cart_item_id) !== targetId);

    isUpdating.value = true;
    try {
      const res = await fetch('/customer/cart/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartId: targetId,
          cartItemId: targetId
        })
      });
      const data = await res.json();
      if (!data.success) {
        items.value = prevItems;
      }
      return data;
    } catch (err) {
      console.error('Cart remove error:', err);
      items.value = prevItems;
      return { success: false, error: err.message };
    } finally {
      isUpdating.value = false;
    }
  }

  return {
    items,
    appliedDiscount,
    isUpdating,
    subtotal,
    deliveryCharge,
    totalAmount,
    totalItemCount,
    updateQuantity,
    removeItem,
  };
}
