const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

// All routes here are already protected by verifyToken + requireRole('customer') in indexRoutes.js

router.get('/dashboard', customerController.renderDashboard);
router.get('/virtual-try-on', customerController.renderVirtualTryOn);
router.get('/frame-catalog', customerController.renderFrameCatalog);
router.get('/frame-details/:id', customerController.renderFrameDetails);
router.get('/ai-recommendations', customerController.renderAIRecommendations);
router.get('/wishlist', customerController.renderWishlist);
router.get('/compare-frames', customerController.renderCompareFrames);
router.post('/compare-data', customerController.getCompareData);
router.get('/try-on-history', customerController.renderTryOnHistory);
router.get('/for-you', customerController.renderForYou);
router.get('/api/for-you', customerController.getForYouApi);
router.get('/api/trending', customerController.getTrendingApi);
router.get('/trending', customerController.renderTrending);
router.get('/nearby-stores', customerController.renderNearbyStores);
router.get('/api/stores', customerController.getStoresApi);

router.get('/cart', customerController.renderCart);
router.get('/checkout', customerController.renderCheckout);
router.get('/payment', customerController.renderPayment);
router.get('/my-orders', customerController.renderMyOrders);
router.get('/order-tracking/:id', customerController.renderOrderTracking);
router.get('/profile', customerController.renderProfile);
router.post('/ai-recommend', customerController.getAIRecommendation);
router.post('/ai-style-suggestion', customerController.getAIStyleSuggestion);
router.post('/wishlist/add', customerController.addToWishlist);
router.post('/wishlist/remove', customerController.removeFromWishlist);
router.post('/tryon-history/save', customerController.saveTryOnResult);
router.post('/tryon-history/delete', customerController.deleteTryOnResult);
router.post('/cart/add', customerController.addToCart);
router.post('/cart/add/:id', customerController.addToCart);
router.post('/cart/update', customerController.updateCartItem);
router.post('/cart/remove', customerController.removeCartItem);
router.post('/checkout/place-order', customerController.placeOrder);
router.post('/checkout', customerController.placeOrder);
router.post('/orders/cancel', customerController.cancelOrder);
router.post('/reviews/submit', customerController.submitReview);
router.post('/reviews/delete', customerController.deleteReview);
router.get('/reviews/list', customerController.getMoreReviews);

// ==========================================
// Phase 5: Dedicated JSON API Endpoints (/customer/api/...)
// ==========================================
router.get('/api/frames', customerController.getFramesApi);
router.get('/api/frame/:id', customerController.getFrameDetailsApi);
router.get('/api/cart', customerController.getCartApi);
router.post('/api/cart/add', customerController.addToCart);
router.post('/api/cart/update', customerController.updateCartItem);
router.post('/api/cart/remove', customerController.removeCartItem);
router.get('/api/wishlist', customerController.getWishlistApi);
router.post('/api/wishlist/toggle', customerController.toggleWishlistApi);
router.get('/api/orders', customerController.getOrdersApi);
router.post('/api/reviews/submit', customerController.submitReview);

module.exports = router;
