/**
 * Progressive enhancement for the server-rendered catalog fallback.
 * Vue replaces these nodes when the catalog island mounts successfully.
 */
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.catalog-fallback-wishlist').forEach((button) => {
        button.addEventListener('click', async () => {
            if (button.disabled) return;

            const frameId = Number(button.dataset.frameId);
            const isWishlisted = button.dataset.wishlisted === 'true';
            const endpoint = isWishlisted
                ? '/customer/wishlist/remove'
                : '/customer/wishlist/add';

            button.disabled = true;

            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ frameId })
                });
                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(result.error || 'Wishlist update failed');
                }

                const nextState = !isWishlisted;
                button.dataset.wishlisted = String(nextState);
                button.setAttribute('aria-pressed', String(nextState));
                button.classList.toggle('wishlist-action-active', nextState);
                button.textContent = nextState ? '♥ Saved to Wishlist' : '♡ Add to Wishlist';
            } catch (error) {
                console.error('Catalog wishlist action failed:', error);
            } finally {
                button.disabled = false;
            }
        });
    });
});
