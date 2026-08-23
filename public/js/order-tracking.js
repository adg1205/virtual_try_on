/**
 * Order Tracking Interactions
 * Displays success notification banners based on URL parameters.
 */
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('placed') === '1') {
        const banner = document.getElementById('orderPlacedSuccessBanner');
        if (banner) {
            banner.style.display = 'block';
        }
    }
});
