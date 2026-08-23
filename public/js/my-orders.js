/**
 * Customer Orders Interaction Module
 * Handles asynchronous order cancellation and UI updates.
 */
document.addEventListener('DOMContentLoaded', () => {
    const cancelBtns = document.querySelectorAll('.btn-cancel-order');

    cancelBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const orderId = e.currentTarget.getAttribute('data-order-id');
            if (!orderId) return;

            if (!confirm("Are you sure you want to cancel this order?")) {
                return;
            }

            e.currentTarget.disabled = true;
            e.currentTarget.textContent = "Cancelling...";

            try {
                const response = await fetch('/customer/orders/cancel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: Number(orderId) })
                });

                const data = await response.json();
                if (data.success) {
                    const row = document.getElementById(`order-row-${orderId}`);
                    if (row) {
                        row.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                        row.style.opacity = '0';
                        row.style.transform = 'scale(0.95)';
                        setTimeout(() => {
                            row.remove();
                            const remainingRows = document.querySelectorAll('.order-table-row');
                            if (remainingRows.length === 0) {
                                window.location.reload();
                            }
                        }, 300);
                    }
                } else {
                    alert(data.error || "Failed to cancel order.");
                    e.currentTarget.disabled = false;
                    e.currentTarget.textContent = "✖ Cancel";
                }
            } catch (err) {
                console.error("Cancel order error:", err);
                alert("Network error. Could not cancel order.");
                e.currentTarget.disabled = false;
                e.currentTarget.textContent = "✖ Cancel";
            }
        });
    });
});
