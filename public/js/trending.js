/**
 * Trending & Popular Indicators Interactions
 */
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.trending-progress-fill[data-progress]').forEach((el) => {
        const progress = el.getAttribute('data-progress') || 0;
        el.style.width = `${progress}%`;
    });
});
