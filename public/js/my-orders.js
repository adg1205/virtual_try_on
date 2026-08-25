document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.btn-cancel-order').forEach(button => {
        button.addEventListener('click', async event => {
            const activeButton = event.currentTarget;
            const orderId = Number(activeButton.dataset.orderId);
            if (!orderId || !window.confirm('Request cancellation for this order?')) return;

            activeButton.disabled = true;
            activeButton.textContent = 'Requesting...';

            try {
                const response = await fetch('/customer/orders/cancel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId })
                });
                const data = await response.json();
                if (!response.ok || !data.success) throw new Error(data.error || 'Cancellation request failed.');

                const badge = document.getElementById(`order-status-badge-${orderId}`);
                if (badge) {
                    badge.textContent = data.status || 'Cancellation Requested';
                    badge.className = 'mo-status-badge mo-status-cancelled';
                } else {
                    window.location.reload();
                    return;
                }
                activeButton.remove();
            } catch (error) {
                window.alert(error.message || 'Could not request cancellation.');
                activeButton.disabled = false;
                activeButton.textContent = 'Request cancellation';
            }
        });
    });
});
