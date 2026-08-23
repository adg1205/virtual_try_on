/**
 * Frame Details Page Interaction Script
 * Handles wishlist toggling, customer reviews, AI styling advice, lens previews, and add-to-cart.
 */
document.addEventListener('DOMContentLoaded', () => {
    const frameIdEl = document.getElementById('frameId');
    const frameId = frameIdEl ? frameIdEl.value : (window.FRAME_ID || location.pathname.split('/').pop());

    // --- WISHLIST TOGGLE ---
    const wishlistBtn = document.getElementById('wishlistBtn');
    if (wishlistBtn) {
        wishlistBtn.addEventListener('click', async function () {
            const isWishlisted = this.getAttribute('data-wishlisted') === 'true';
            const endpoint = isWishlisted ? '/customer/wishlist/remove' : '/customer/wishlist/add';

            this.disabled = true;
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ frameId: frameId })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        const newWishlisted = !isWishlisted;
                        this.setAttribute('data-wishlisted', String(newWishlisted));

                        const svg = this.querySelector('svg');
                        if (svg) svg.setAttribute('fill', newWishlisted ? 'currentColor' : 'none');
                        this.style.color = newWishlisted ? '#f87171' : '';
                        const textSpan = document.getElementById('wishlistBtnText');
                        if (textSpan) textSpan.textContent = newWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist';
                    }
                }
            } catch (err) {
                console.error("Wishlist action failed:", err);
            } finally {
                this.disabled = false;
            }
        });
    }

    // --- REVIEWS SYSTEM ---
    const starBtns = document.querySelectorAll('#starRatingInput .star-btn');
    const ratingValueInput = document.getElementById('ratingValueInput');
    const starRatingLabel = document.getElementById('starRatingLabel');

    const ratingDescriptions = {
        1: "1 / 5 Stars (Poor)",
        2: "2 / 5 Stars (Fair)",
        3: "3 / 5 Stars (Good)",
        4: "4 / 5 Stars (Very Good)",
        5: "5 / 5 Stars (Excellent)"
    };

    let selectedRating = parseInt(ratingValueInput ? ratingValueInput.value : 5, 10);

    function updateStarsUI(val) {
        starBtns.forEach(btn => {
            const btnVal = parseInt(btn.getAttribute('data-value'), 10);
            if (btnVal <= val) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        if (starRatingLabel) {
            starRatingLabel.textContent = ratingDescriptions[val] || `${val} / 5 Stars`;
        }
    }

    if (starBtns.length > 0 && ratingValueInput) {
        updateStarsUI(selectedRating);

        starBtns.forEach(btn => {
            btn.addEventListener('mouseenter', function () {
                const hoverVal = parseInt(this.getAttribute('data-value'), 10);
                updateStarsUI(hoverVal);
            });

            btn.addEventListener('click', function () {
                selectedRating = parseInt(this.getAttribute('data-value'), 10);
                ratingValueInput.value = selectedRating;
                updateStarsUI(selectedRating);
            });
        });

        const starContainer = document.getElementById('starRatingInput');
        if (starContainer) {
            starContainer.addEventListener('mouseleave', function () {
                updateStarsUI(selectedRating);
            });
        }
    }

    const editReviewToggleBtn = document.getElementById('editReviewToggleBtn');
    const cancelEditReviewBtn = document.getElementById('cancelEditReviewBtn');
    const reviewFormCard = document.getElementById('reviewFormCard');
    const myExistingReviewPanel = document.getElementById('myExistingReviewPanel');

    if (editReviewToggleBtn && reviewFormCard) {
        editReviewToggleBtn.addEventListener('click', () => {
            reviewFormCard.style.display = 'block';
            if (myExistingReviewPanel) myExistingReviewPanel.style.display = 'none';
            reviewFormCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    }

    if (cancelEditReviewBtn && reviewFormCard && myExistingReviewPanel) {
        cancelEditReviewBtn.addEventListener('click', () => {
            reviewFormCard.style.display = 'none';
            myExistingReviewPanel.style.display = 'block';
        });
    }

    const reviewSubmitForm = document.getElementById('reviewSubmitForm');
    const submitReviewBtn = document.getElementById('submitReviewBtn');

    if (reviewSubmitForm) {
        reviewSubmitForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rating = ratingValueInput ? ratingValueInput.value : '5';
            const comment = document.getElementById('reviewComment')?.value || '';

            if (submitReviewBtn) {
                submitReviewBtn.disabled = true;
                submitReviewBtn.textContent = 'Saving...';
            }

            try {
                const response = await fetch('/customer/reviews/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        frameId: frameId,
                        rating: rating,
                        comment: comment
                    })
                });

                const data = await response.json();
                if (response.ok && data.success) {
                    showToast('Review submitted successfully! ⭐', 'success');
                    setTimeout(() => window.location.reload(), 800);
                } else {
                    showToast(data.error || 'Failed to submit review', 'error');
                    if (submitReviewBtn) {
                        submitReviewBtn.disabled = false;
                        submitReviewBtn.textContent = 'Submit Review';
                    }
                }
            } catch (err) {
                console.error("Error submitting review:", err);
                showToast('An error occurred. Please try again.', 'error');
                if (submitReviewBtn) {
                    submitReviewBtn.disabled = false;
                    submitReviewBtn.textContent = 'Submit Review';
                }
            }
        });
    }

    const deleteMyReviewBtn = document.getElementById('deleteMyReviewBtn');
    if (deleteMyReviewBtn) {
        deleteMyReviewBtn.addEventListener('click', async function () {
            const reviewId = this.getAttribute('data-review-id');
            if (!reviewId) return;

            if (!confirm('Are you sure you want to delete your review?')) return;

            this.disabled = true;
            try {
                const response = await fetch('/customer/reviews/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reviewId: reviewId })
                });

                const data = await response.json();
                if (response.ok && data.success) {
                    showToast('Your review has been deleted.', 'success');
                    setTimeout(() => window.location.reload(), 800);
                } else {
                    showToast(data.error || 'Failed to delete review', 'error');
                    this.disabled = false;
                }
            } catch (err) {
                console.error("Error deleting review:", err);
                showToast('An error occurred. Please try again.', 'error');
                this.disabled = false;
            }
        });
    }

    const loadMoreReviewsBtn = document.getElementById('loadMoreReviewsBtn');
    if (loadMoreReviewsBtn) {
        loadMoreReviewsBtn.addEventListener('click', async function () {
            const fId = this.getAttribute('data-frame-id') || frameId;
            const offset = parseInt(this.getAttribute('data-offset'), 10) || 5;

            this.disabled = true;
            this.textContent = 'Loading...';

            try {
                const response = await fetch(`/customer/reviews/list?frameId=${fId}&offset=${offset}&limit=5`);
                const data = await response.json();

                if (response.ok && data.success) {
                    const reviewsList = document.getElementById('reviewsList');

                    data.reviews.forEach(rev => {
                        const dateStr = new Date(rev.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                        let starsHtml = '';
                        for (let i = 1; i <= 5; i++) {
                            starsHtml += `<span class="star-icon ${i <= rev.rating ? 'filled' : ''}">★</span>`;
                        }
                        const initial = rev.full_name ? rev.full_name.charAt(0).toUpperCase() : 'U';

                        const card = document.createElement('div');
                        card.className = 'glass-panel review-card-item';
                        card.innerHTML = `
                            <div class="review-card-header">
                                <div class="reviewer-info">
                                    <div class="reviewer-avatar">${initial}</div>
                                    <div>
                                        <div class="reviewer-name">${rev.full_name}</div>
                                        <div class="review-date">${dateStr}</div>
                                    </div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 0.75rem;">
                                    <div class="stars-row-sm">${starsHtml}</div>
                                </div>
                            </div>
                            <p class="review-comment-text">${rev.comment || '<span style="color: #9ca3af; font-style: italic;">No written comment.</span>'}</p>
                        `;
                        reviewsList.appendChild(card);
                    });

                    const newOffset = offset + data.reviews.length;
                    this.setAttribute('data-offset', newOffset);

                    const reviewsCountBadge = document.getElementById('reviewsCountBadge');
                    if (reviewsCountBadge) {
                        reviewsCountBadge.textContent = `Showing ${newOffset} reviews`;
                    }

                    if (!data.hasMore) {
                        this.remove();
                    } else {
                        this.disabled = false;
                        this.textContent = 'Load More Reviews 👇';
                    }
                } else {
                    showToast(data.error || 'Failed to load more reviews', 'error');
                    this.disabled = false;
                    this.textContent = 'Load More Reviews 👇';
                }
            } catch (err) {
                console.error("Error loading more reviews:", err);
                showToast('Failed to load more reviews.', 'error');
                this.disabled = false;
                this.textContent = 'Load More Reviews 👇';
            }
        });
    }

    function showToast(message, type = 'success') {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        toast.innerHTML = `<span>${type === 'success' ? '✅' : '⚠️'}</span> <span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
});
