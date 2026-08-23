/**
 * For-You Personalized Feed Interactions
 * Handles client-side wishlist toggling on personalized recommendation cards.
 */
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.catalog-wishlist-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const frameId = btn.getAttribute('data-frame-id');
            const isWishlisted = btn.getAttribute('data-wishlisted') === 'true';
            const endpoint = isWishlisted ? '/customer/wishlist/remove' : '/customer/wishlist/add';

            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ frameId: Number(frameId) })
                });
                const data = await res.json();
                if (data.success) {
                    const newWishlisted = !isWishlisted;
                    btn.setAttribute('data-wishlisted', newWishlisted ? 'true' : 'false');
                    btn.style.color = newWishlisted ? '#f87171' : '#cbd5e1';
                    const svg = btn.querySelector('svg');
                    if (svg) {
                        svg.setAttribute('fill', newWishlisted ? 'currentColor' : 'none');
                    }
                }
            } catch (err) {
                console.error('Failed to toggle wishlist:', err);
            }
        });
    });
});
