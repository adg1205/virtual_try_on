document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.btn-cancel-order').forEach(button => {
        button.addEventListener('click', async event => {
            const activeButton = event.currentTarget;
            const orderId = Number(activeButton.dataset.orderId);
            if (!orderId || !window.confirm('Cancel this order? It will be removed from My Orders.')) return;

            activeButton.disabled = true;
            activeButton.textContent = 'Cancelling...';

            try {
                const response = await fetch('/customer/orders/cancel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId })
                });
                const data = await response.json();
                if (!response.ok || !data.success) throw new Error(data.error || 'Order cancellation failed.');

                // Reload from the server so the cancelled row disappears and the
                // empty state is rendered correctly when this was the last order.
                window.location.reload();
            } catch (error) {
                window.alert(error.message || 'Could not cancel the order.');
                activeButton.disabled = false;
                activeButton.textContent = 'Cancel order';
            }
        });
    });
});
