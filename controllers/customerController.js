// Customer Controller - Handles rendering of all customer pages
const db = require('../models/Database');
const cloudinaryService = require('../utils/cloudinaryService');
const emailService = require('../utils/emailService');
const stripeService = require('../utils/stripeService');
const sslcommerzService = require('../utils/sslcommerzService');
const { STORES, DHAKA_AREAS } = require('../utils/storeData');
const {
    createFrameRecommendation,
    createStyleSuggestion
} = require('../utils/geminiStylistService');
const {
    normalizeLensTintLabelForFrame
} = require('../public/js/lens-tint-palette');


exports.renderDashboard = async (req, res) => {
    try {
        const [wishlistIds, tryOnCount, cartCount, orderCount] = await Promise.all([
            db.getUserWishlistIds(req.user.id),
            db.getUserTryOnCount(req.user.id),
            db.getCartItemCount(req.user.id),
            db.getUserOrderCount(req.user.id)
        ]);
        res.render('customer/dashboard', { 
            title: 'Customer Dashboard', 
            user: req.user, 
            currentPage: 'dashboard', 
            wishlistCount: wishlistIds.length,
            tryOnCount: tryOnCount,
            cartCount: cartCount,
            orderCount: orderCount
        });
    } catch (err) {
        console.error("Error rendering customer dashboard:", err);
        res.render('customer/dashboard', { 
            title: 'Customer Dashboard', 
            user: req.user, 
            currentPage: 'dashboard', 
            wishlistCount: 0,
            tryOnCount: 0,
            cartCount: 0,
            orderCount: 0
        });
    }
};

exports.renderVirtualTryOn = async (req, res) => {
    try {
        let frame = null;
        if (req.query.frameId) {
            frame = await db.getFrameById(req.query.frameId);
        }
        const frames = await db.getAllFrames();
        res.render('customer/virtual-try-on', { title: 'Virtual Try-On', user: req.user, currentPage: 'virtual-try-on', frame, frames });
    } catch (err) {
        console.error('Error fetching frame for try-on:', err);
        res.render('customer/virtual-try-on', { title: 'Virtual Try-On', user: req.user, currentPage: 'virtual-try-on', frame: null, frames: [] });
    }
};

exports.renderFrameCatalog = async (req, res) => {
    try {
        const allowedSorts = ['price_asc', 'price_desc', 'newest', 'availability', 'popularity', 'most_tried'];
        const sortBy = allowedSorts.includes(req.query.sort) ? req.query.sort : '';
        const frames = await db.getAllFramesSorted(sortBy);
        const wishlistIds = await db.getUserWishlistIds(req.user.id);
        res.render('customer/frame-catalog', { title: 'Frame Catalog', user: req.user, currentPage: 'frame-catalog', frames, wishlistIds, currentSort: sortBy });
    } catch (err) {
        console.error('Error fetching frames:', err);
        res.render('customer/frame-catalog', { title: 'Frame Catalog', user: req.user, currentPage: 'frame-catalog', frames: [], wishlistIds: [], currentSort: '' });
    }
};

exports.renderFrameDetails = async (req, res) => {
    try {
        const frame = await db.getFrameById(req.params.id);
        if (!frame) {
            return res.status(404).render('error/404', { title: 'Frame Not Found', user: req.user });
        }
        const [wishlistIds, similarFrames, reviews, reviewStats, userReview] = await Promise.all([
            db.getUserWishlistIds(req.user.id),
            db.getSimilarFrames(frame.id, 4),
            db.getFrameReviews(frame.id, 5, 0),
            db.getFrameReviewStats(frame.id),
            db.getUserReviewForFrame(req.user.id, frame.id)
        ]);
        const isWishlisted = wishlistIds.includes(frame.id);
        const isEligibleToReview = true;
        res.render('customer/frame-details', { 
            title: frame.name, 
            user: req.user, 
            currentPage: 'frame-catalog', 
            frame, 
            isWishlisted,
            similarFrames,
            reviews,
            reviewStats,
            userReview,
            isEligibleToReview
        });
    } catch (err) {
        console.error('Error fetching frame details:', err);
        res.redirect('/customer/frame-catalog');
    }
};

exports.submitReview = async (req, res) => {
    try {
        const { frameId, rating, comment } = req.body;
        if (!frameId || !rating) {
            return res.status(400).json({ success: false, error: 'Frame ID and rating are required.' });
        }

        const parsedRating = parseInt(rating, 10);
        if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
            return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5 stars.' });
        }

        const frame = await db.getFrameById(frameId);
        if (!frame) {
            return res.status(404).json({ success: false, error: 'Frame not found.' });
        }

        const isEligible = await db.checkReviewEligibility(req.user.id, parseInt(frameId, 10));
        if (!isEligible) {
            return res.status(403).json({ success: false, error: 'You must try on or order this frame before submitting a review.' });
        }

        const trimmedComment = comment ? comment.trim().slice(0, 1000) : null;
        await db.createOrUpdateReview(req.user.id, parseInt(frameId, 10), parsedRating, trimmedComment);

        const [reviewStats, userReview] = await Promise.all([
            db.getFrameReviewStats(parseInt(frameId, 10)),
            db.getUserReviewForFrame(req.user.id, parseInt(frameId, 10))
        ]);

        return res.json({
            success: true,
            reviewStats,
            userReview
        });
    } catch (err) {
        console.error('Error submitting review:', err);
        return res.status(500).json({ success: false, error: 'Failed to submit review. Please try again.' });
    }
};

exports.deleteReview = async (req, res) => {
    try {
        const { reviewId } = req.body;
        if (!reviewId) {
            return res.status(400).json({ success: false, error: 'Missing reviewId.' });
        }

        const changes = await db.deleteReview(parseInt(reviewId, 10), req.user.id);
        if (changes === 0) {
            return res.status(404).json({ success: false, error: 'Review not found or unauthorized.' });
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('Error deleting review:', err);
        return res.status(500).json({ success: false, error: 'Failed to delete review.' });
    }
};

exports.getMoreReviews = async (req, res) => {
    try {
        const frameId = parseInt(req.query.frameId, 10);
        const offset = parseInt(req.query.offset, 10) || 0;
        const limit = parseInt(req.query.limit, 10) || 5;

        if (isNaN(frameId)) {
            return res.status(400).json({ success: false, error: 'Invalid frameId.' });
        }

        const reviews = await db.getFrameReviews(frameId, limit, offset);
        const reviewStats = await db.getFrameReviewStats(frameId);
        const hasMore = (offset + reviews.length) < reviewStats.total_reviews;

        return res.json({
            success: true,
            reviews,
            hasMore
        });
    } catch (err) {
        console.error('Error fetching more reviews:', err);
        return res.status(500).json({ success: false, error: 'Failed to load reviews.' });
    }
};

exports.renderAIRecommendations = async (req, res) => {
    try {
        const frames = await db.getAllFrames();
        res.render('customer/ai-recommendations', {
            title: 'AI Recommendations',
            user: req.user,
            currentPage: 'ai-recommendations',
            frames: frames || []
        });
    } catch (err) {
        console.error('Error rendering AI recommendations:', err);
        res.render('customer/ai-recommendations', {
            title: 'AI Recommendations',
            user: req.user,
            currentPage: 'ai-recommendations',
            frames: []
        });
    }
};

exports.getAIRecommendation = async (req, res) => {
    try {
        const { faceShape, metrics } = req.body;
        const recommendation = await createFrameRecommendation({ faceShape, metrics });
        const frames = await db.getFramesByShapes(recommendation.recommendedShapes);

        return res.json({
            success: true,
            ...recommendation,
            frames
        });
    } catch (err) {
        if (err.code === 'INVALID_FACE_SHAPE') {
            return res.status(400).json({ success: false, error: err.message });
        }
        console.error("Error generating AI recommendation:", err);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

exports.renderWishlist = async (req, res) => {
    try {
        const wishlistedFrames = await db.getUserWishlist(req.user.id);
        res.render('customer/wishlist', { title: 'Wishlist', user: req.user, currentPage: 'wishlist', frames: wishlistedFrames });
    } catch (err) {
        console.error('Error fetching wishlist:', err);
        res.render('customer/wishlist', { title: 'Wishlist', user: req.user, currentPage: 'wishlist', frames: [] });
    }
};

exports.renderCompareFrames = async (req, res) => {
    try {
        const frames = await db.getAllFrames();
        res.render('customer/compare-frames', { title: 'Compare Frames', user: req.user, currentPage: 'compare-frames', frames });
    } catch (err) {
        console.error('Error fetching frames for comparison:', err);
        res.render('customer/compare-frames', { title: 'Compare Frames', user: req.user, currentPage: 'compare-frames', frames: [] });
    }
};

exports.getCompareData = async (req, res) => {
    try {
        const { frameId1, frameId2 } = req.body;
        if (!frameId1 || !frameId2) {
            return res.status(400).json({ success: false, error: 'Two frame IDs required' });
        }

        const [frame1, frame2, tryon1, tryon2] = await Promise.all([
            db.getFrameById(frameId1),
            db.getFrameById(frameId2),
            db.getLatestTryOnForFrame(req.user.id, frameId1),
            db.getLatestTryOnForFrame(req.user.id, frameId2)
        ]);

        if (!frame1 || !frame2) {
            return res.status(404).json({ success: false, error: 'One or both frames not found' });
        }

        // Persist the activity before reporting success so the next visit to
        // the trending page immediately includes this comparison.
        const comparisonId = await db.logFrameComparison(req.user.id, frameId1, frameId2);

        return res.json({
            success: true,
            comparisonId,
            frame1,
            frame2,
            tryon1,
            tryon2
        });
    } catch (err) {
        console.error("Error fetching compare data:", err);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};


exports.renderTryOnHistory = async (req, res) => {
    try {
        const historyItems = (await db.getUserTryOnHistory(req.user.id)).map(item => ({
            ...item,
            lens_option: normalizeLensTintLabelForFrame(item, item.lens_option)
        }));
        res.render('customer/try-on-history', { 
            title: 'Try-On History', 
            user: req.user, 
            currentPage: 'try-on-history',
            history: historyItems
        });
    } catch (err) {
        console.error('Error fetching try-on history:', err);
        res.render('customer/try-on-history', { 
            title: 'Try-On History', 
            user: req.user, 
            currentPage: 'try-on-history',
            history: []
        });
    }
};

exports.renderNearbyStores = (req, res) => {
    const mapTilerKey = process.env.MAPTILER_API_KEY || '';
    res.render('customer/nearby-stores', {
        title: 'Nearby Optical Stores',
        user: req.user,
        currentPage: 'nearby-stores',
        loadMap: true,
        stores: STORES,
        dhakaAreas: DHAKA_AREAS,
        mapTilerKey: mapTilerKey
    });
};

exports.getStoresApi = (req, res) => {
    res.json({
        success: true,
        stores: STORES,
        dhakaAreas: DHAKA_AREAS
    });
};


exports.renderCart = async (req, res) => {
    try {
        const cartItems = await db.getUserCart(req.user.id);
        
        let subtotal = 0;
        let totalItemCount = 0;
        cartItems.forEach(item => {
            subtotal += item.price * item.quantity;
            totalItemCount += item.quantity;
        });

        const deliveryThreshold = 200.00;
        const flatDeliveryFee = 5.00;
        const deliveryCharge = (cartItems.length > 0 && subtotal < deliveryThreshold) ? flatDeliveryFee : 0;
        const totalAmount = subtotal + deliveryCharge;

        res.render('customer/cart', { 
            title: 'Shopping Cart', 
            user: req.user, 
            currentPage: 'cart',
            cartItems,
            totalItemCount,
            subtotal,
            deliveryCharge,
            totalAmount,
            deliveryThreshold
        });
    } catch (err) {
        console.error("Error rendering cart:", err);
        res.render('customer/cart', { 
            title: 'Shopping Cart', 
            user: req.user, 
            currentPage: 'cart',
            cartItems: [],
            totalItemCount: 0,
            subtotal: 0,
            deliveryCharge: 0,
            totalAmount: 0,
            deliveryThreshold: 200.00
        });
    }
};

exports.addToCart = async (req, res) => {
    try {
        const frameId = req.body.frameId || req.body.frame_id || req.params.id;
        const lensOption = req.body.lensOption || req.body.lens_option || 'Clear Standard';
        const selectedVariant = req.body.selectedVariant || req.body.selected_variant || null;
        const quantity = req.body.quantity || 1;

        if (!frameId) {
            return res.status(400).json({ success: false, error: 'Missing frameId' });
        }

        const frame = await db.getFrameById(frameId);
        if (!frame) {
            return res.status(404).json({ success: false, error: 'Frame not found' });
        }

        if (!frame.availability) {
            return res.status(400).json({ success: false, error: 'This frame is currently out of stock' });
        }

        const itemQty = Math.max(1, Math.min(10, parseInt(quantity, 10) || 1));

        await db.addToCart(req.user.id, {
            frameId: parseInt(frameId, 10),
            lensOption: normalizeLensTintLabelForFrame(frame, lensOption),
            quantity: itemQty,
            // Price is always sourced from the database. Never trust a price
            // submitted by the browser, which a customer could modify.
            price: frame.price,
            selectedVariant: selectedVariant || frame.color
        });

        const cartItemCount = await db.getCartItemCount(req.user.id);
        const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json')) || (req.headers['content-type'] && req.headers['content-type'].includes('application/json'));

        if (isJson) {
            return res.json({ success: true, cartItemCount, frameName: frame.name });
        } else {
            return res.redirect('/customer/cart');
        }
    } catch (err) {
        console.error("Error adding to cart:", err);
        return res.status(500).json({ success: false, error: 'Failed to add item to cart' });
    }
};

exports.updateCartItem = async (req, res) => {
    try {
        const cartId = req.body.cartId || req.body.cartItemId || req.body.id;
        const quantity = req.body.quantity;
        if (!cartId || quantity === undefined) {
            return res.status(400).json({ success: false, error: 'Missing cartId or quantity' });
        }

        const newQty = parseInt(quantity, 10);
        if (isNaN(newQty) || newQty < 1 || newQty > 10) {
            return res.status(400).json({ success: false, error: 'Quantity must be between 1 and 10' });
        }

        await db.updateCartQuantity(req.user.id, parseInt(cartId, 10), newQty);

        const cartItems = await db.getUserCart(req.user.id);
        let subtotal = 0;
        cartItems.forEach(item => {
            subtotal += (item.price || 0) * item.quantity;
        });

        const deliveryThreshold = 200.00;
        const flatDeliveryFee = 5.00;
        const deliveryCharge = (cartItems.length > 0 && subtotal < deliveryThreshold) ? flatDeliveryFee : 0;
        const totalAmount = subtotal + deliveryCharge;
        const cartItemCount = await db.getCartItemCount(req.user.id);

        return res.json({
            success: true,
            subtotal,
            deliveryCharge,
            totalAmount,
            cartItemCount,
            cartItems
        });
    } catch (err) {
        console.error("Error updating cart item:", err);
        return res.status(500).json({ success: false, error: 'Failed to update cart item' });
    }
};

exports.removeCartItem = async (req, res) => {
    try {
        const cartId = req.body.cartId || req.body.cartItemId || req.body.id;
        if (!cartId) {
            return res.status(400).json({ success: false, error: 'Missing cartId' });
        }

        await db.removeFromCart(req.user.id, parseInt(cartId, 10));

        const cartItems = await db.getUserCart(req.user.id);
        let subtotal = 0;
        cartItems.forEach(item => {
            subtotal += (item.price || 0) * item.quantity;
        });

        const deliveryThreshold = 200.00;
        const flatDeliveryFee = 5.00;
        const deliveryCharge = (cartItems.length > 0 && subtotal < deliveryThreshold) ? flatDeliveryFee : 0;
        const totalAmount = subtotal + deliveryCharge;
        const cartItemCount = await db.getCartItemCount(req.user.id);

        return res.json({
            success: true,
            subtotal,
            deliveryCharge,
            totalAmount,
            cartItemCount,
            isEmpty: cartItems.length === 0,
            cartItems
        });
    } catch (err) {
        console.error("Error removing cart item:", err);
        return res.status(500).json({ success: false, error: 'Failed to remove cart item' });
    }
};


exports.renderCheckout = async (req, res) => {
    try {
        const cartItems = await db.getUserCart(req.user.id);
        if (!cartItems || cartItems.length === 0) {
            return res.redirect('/customer/cart');
        }

        let subtotal = 0;
        let totalItemCount = 0;
        cartItems.forEach(item => {
            subtotal += (item.price || 0) * item.quantity;
            totalItemCount += item.quantity;
        });

        const deliveryThreshold = 200.00;
        const flatDeliveryFee = 5.00;
        const deliveryCharge = (subtotal < deliveryThreshold) ? flatDeliveryFee : 0;
        const totalAmount = subtotal + deliveryCharge;

        res.render('customer/checkout', { 
            title: 'Checkout', 
            user: req.user, 
            currentPage: 'checkout',
            cartItems,
            totalItemCount,
            subtotal,
            deliveryCharge,
            totalAmount
        });
    } catch (err) {
        console.error("Error rendering checkout:", err);
        res.redirect('/customer/cart');
    }
};

exports.placeOrder = async (req, res) => {
    try {
        const { deliveryAddress, contactNumber, orderNote, paymentMethod } = req.body;
        
        if (!deliveryAddress || !deliveryAddress.trim()) {
            return res.status(400).json({ success: false, error: 'Delivery address is required' });
        }
        if (!contactNumber || !contactNumber.trim()) {
            return res.status(400).json({ success: false, error: 'Contact number is required' });
        }
        if (!paymentMethod) {
            return res.status(400).json({ success: false, error: 'Payment method is required' });
        }

        let method = paymentMethod.toLowerCase().trim();
        if (method === 'mfs' || method === 'sslcommerz') {
            method = 'bkash';
        }

        const validMethods = ['cod', 'card', 'bkash', 'nagad'];
        if (!validMethods.includes(method)) {
            return res.status(400).json({ success: false, error: 'Invalid payment method selected' });
        }

        const cartItems = await db.getUserCart(req.user.id);
        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({ success: false, error: 'Your cart is empty' });
        }

        let subtotal = 0;
        cartItems.forEach(item => {
            subtotal += (item.price || 0) * item.quantity;
        });

        const deliveryThreshold = 200.00;
        const flatDeliveryFee = 5.00;
        const deliveryCharge = (subtotal < deliveryThreshold) ? flatDeliveryFee : 0;
        const totalAmount = subtotal + deliveryCharge;

        const protocol = req.protocol || 'http';
        const host = req.get('host') || 'localhost:3000';
        const baseUrl = process.env.BASE_URL || `${protocol}://${host}`;

        // 1. CASH ON DELIVERY (COD) FLOW
        if (method === 'cod') {
            const timestamp = Date.now().toString().slice(-6);
            const randomCode = Math.floor(1000 + Math.random() * 9000);
            const orderNumber = `ORD-${timestamp}-${randomCode}`;

            const orderId = await db.createOrder({
                userId: req.user.id,
                orderNumber,
                deliveryAddress: deliveryAddress.trim(),
                contactNumber: contactNumber.trim(),
                orderNote: orderNote ? orderNote.trim() : null,
                paymentMethod: 'cod',
                subtotal,
                deliveryCharge,
                totalAmount,
                status: 'Placed',
                paymentStatus: 'unpaid'
            });

            await db.createOrderItems(orderId, cartItems);
            await db.clearCart(req.user.id);

            // Send order confirmation email asynchronously
            db.getOrderById(orderId, req.user.id).then(order => {
                if (order) {
                    emailService.sendOrderConfirmationEmail(order, req.user);
                }
            }).catch(emailErr => console.error("Email send error:", emailErr));

            return res.json({
                success: true,
                requiresPayment: false,
                orderId,
                orderNumber
            });
        }

        // 2. STRIPE CARD PAYMENT FLOW
        if (method === 'card') {
            try {
                const session = await stripeService.createCheckoutSession({
                    amount: totalAmount,
                    orderDetails: {
                        deliveryAddress: deliveryAddress.trim(),
                        contactNumber: contactNumber.trim(),
                        orderNote: orderNote ? orderNote.trim() : null,
                        subtotal,
                        deliveryCharge,
                        cartItems
                    },
                    user: req.user,
                    successUrl: `${baseUrl}/customer/payment/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
                    cancelUrl: `${baseUrl}/customer/payment/stripe/cancel`
                });

                return res.json({
                    success: true,
                    requiresPayment: true,
                    gateway: 'stripe',
                    redirectUrl: session.url
                });
            } catch (stripeErr) {
                console.error("Stripe Checkout Error:", stripeErr);
                return res.status(500).json({
                    success: false,
                    error: stripeErr.message || 'Failed to initiate Stripe Card payment. Check your API keys.'
                });
            }
        }

        // 3. SSLCOMMERZ (bKash / Nagad) PAYMENT FLOW
        if (method === 'bkash' || method === 'nagad') {
            try {
                const tran_id = `TRAN-${Date.now()}-${req.user.id}-${method}`;
                const sslResponse = await sslcommerzService.initiateSSLCommerzPayment({
                    tran_id,
                    amount: totalAmount,
                    orderDetails: {
                        deliveryAddress: deliveryAddress.trim(),
                        contactNumber: contactNumber.trim(),
                        orderNote: orderNote ? orderNote.trim() : null,
                        subtotal,
                        deliveryCharge,
                        cartItems
                    },
                    user: req.user,
                    paymentMethod: method,
                    successUrl: `${baseUrl}/customer/payment/sslcommerz/success`,
                    failUrl: `${baseUrl}/customer/payment/sslcommerz/fail`,
                    cancelUrl: `${baseUrl}/customer/payment/sslcommerz/cancel`,
                    ipnUrl: `${baseUrl}/customer/payment/sslcommerz/ipn`
                });

                if (sslResponse && sslResponse.GatewayPageURL) {
                    return res.json({
                        success: true,
                        requiresPayment: true,
                        gateway: 'sslcommerz',
                        redirectUrl: sslResponse.GatewayPageURL
                    });
                } else {
                    console.error("SSLCommerz Invalid Response:", sslResponse);
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to initiate mobile gateway payment. Please try again.'
                    });
                }
            } catch (sslErr) {
                console.error("SSLCommerz Error:", sslErr);
                return res.status(500).json({
                    success: false,
                    error: sslErr.message || 'Failed to connect to SSLCommerz sandbox gateway.'
                });
            }
        }

    } catch (err) {
        console.error("Error in placeOrder:", err);
        return res.status(500).json({ success: false, error: 'Failed to process checkout. Please try again.' });
    }
};

exports.renderPayment = (req, res) => {
    res.redirect('/customer/checkout');
};

exports.renderMyOrders = async (req, res) => {
    try {
        const orders = await db.getUserOrders(req.user.id);
        res.render('customer/my-orders', { 
            title: 'My Orders', 
            user: req.user, 
            currentPage: 'my-orders',
            orders 
        });
    } catch (err) {
        console.error("Error rendering my orders:", err);
        res.render('customer/my-orders', { 
            title: 'My Orders', 
            user: req.user, 
            currentPage: 'my-orders',
            orders: [] 
        });
    }
};

exports.cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!orderId) {
            return res.status(400).json({ success: false, error: 'Missing orderId' });
        }

        const changes = await db.cancelOrder(parseInt(orderId, 10), req.user.id);
        if (changes === 0) {
            return res.status(400).json({ success: false, error: 'Order cannot be cancelled or was not found' });
        }

        return res.json({ success: true });
    } catch (err) {
        console.error("Error cancelling order:", err);
        return res.status(500).json({ success: false, error: 'Failed to cancel order' });
    }
};

exports.renderOrderTracking = async (req, res) => {
    try {
        const orderId = parseInt(req.params.id, 10);
        if (isNaN(orderId)) {
            return res.redirect('/customer/my-orders');
        }

        const order = await db.getOrderById(orderId, req.user.id);
        if (!order) {
            return res.status(404).render('error/404', { title: 'Order Not Found', user: req.user });
        }

        res.render('customer/order-tracking', { 
            title: `Order #${order.order_number}`, 
            user: req.user, 
            currentPage: 'order-tracking', 
            order 
        });
    } catch (err) {
        console.error("Error rendering order tracking:", err);
        res.redirect('/customer/my-orders');
    }
};

exports.renderProfile = (req, res) => {
    res.render('customer/profile', { title: 'My Profile', user: req.user, currentPage: 'profile' });
};

exports.getAIStyleSuggestion = async (req, res) => {
    try {
        const { frameId, color, lensStyle, faceShape } = req.body;
        if (!frameId) {
            return res.status(400).json({ success: false, error: 'Missing frameId' });
        }

        const frame = await db.getFrameById(frameId);
        if (!frame) {
            return res.status(404).json({ success: false, error: 'Frame not found' });
        }
        const normalizedLensStyle = normalizeLensTintLabelForFrame(frame, lensStyle);
        const result = await createStyleSuggestion({
            frame,
            color,
            lensStyle: normalizedLensStyle,
            faceShape
        });

        return res.json({ success: true, ...result });
    } catch (err) {
        console.error("Error generating style suggestion:", err);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

exports.addToWishlist = async (req, res) => {
    try {
        const { frameId } = req.body;
        if (!frameId) {
            return res.status(400).json({ success: false, error: 'Missing frameId' });
        }
        await db.addToWishlist(req.user.id, frameId);
        res.json({ success: true });
    } catch (err) {
        console.error("Error adding to wishlist:", err);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

exports.removeFromWishlist = async (req, res) => {
    try {
        const { frameId } = req.body;
        if (!frameId) {
            return res.status(400).json({ success: false, error: 'Missing frameId' });
        }
        await db.removeFromWishlist(req.user.id, frameId);
        res.json({ success: true });
    } catch (err) {
        console.error("Error removing from wishlist:", err);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

exports.saveTryOnResult = async (req, res) => {
    try {
        const { imageData, frameId, lensOption, colorOption, faceShape } = req.body;
        if (!imageData || !frameId) {
            return res.status(400).json({ success: false, error: 'Missing imageData or frameId' });
        }

        const frame = await db.getFrameById(frameId);
        if (!frame) {
            return res.status(404).json({ success: false, error: 'Frame not found' });
        }

        let imageUrl = '';
        let publicId = '';

        if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name') {
            const uploadResult = await cloudinaryService.uploadImage(imageData);
            imageUrl = uploadResult.secure_url;
            publicId = uploadResult.public_id;
        } else {
            console.warn('Cloudinary credentials not set in .env. Storing image data URI directly.');
            imageUrl = imageData;
            publicId = `local_${Date.now()}`;
        }

        const historyId = await db.saveTryOnResult({
            userId: req.user.id,
            frameId: parseInt(frameId, 10),
            imageUrl,
            cloudinaryPublicId: publicId,
            lensOption: normalizeLensTintLabelForFrame(frame, lensOption),
            colorOption: colorOption || frame.color,
            faceShape: faceShape || null
        });

        return res.json({ success: true, historyId, imageUrl });
    } catch (err) {
        console.error('Error saving try-on result:', err);
        return res.status(500).json({ success: false, error: err.message || 'Failed to save try-on result' });
    }
};

exports.deleteTryOnResult = async (req, res) => {
    try {
        const { historyId } = req.body;
        if (!historyId) {
            return res.status(400).json({ success: false, error: 'Missing historyId' });
        }

        const numericId = parseInt(historyId, 10);
        if (isNaN(numericId)) {
            return res.status(400).json({ success: false, error: 'Invalid historyId' });
        }

        const item = await db.getTryOnHistoryById(numericId);
        if (!item) {
            return res.status(404).json({ success: false, error: 'History item not found' });
        }

        if (parseInt(item.user_id, 10) !== parseInt(req.user.id, 10)) {
            return res.status(403).json({ success: false, error: 'Unauthorized to delete this item' });
        }

        if (process.env.CLOUDINARY_CLOUD_NAME && 
            process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name' && 
            item.cloudinary_public_id && 
            !item.cloudinary_public_id.startsWith('local_')) {
            try {
                await cloudinaryService.deleteImage(item.cloudinary_public_id);
            } catch (cErr) {
                console.warn('Failed to delete Cloudinary image, continuing DB delete:', cErr);
            }
        }

        await db.deleteTryOnHistory(numericId);
        return res.json({ success: true });
    } catch (err) {
        console.error('Error deleting try-on result:', err);
        return res.status(500).json({ success: false, error: 'Failed to delete try-on result' });
    }
};

exports.renderForYou = async (req, res) => {
    try {
        const { recommendations, hasActivity } = await db.getPersonalizedRecommendations(req.user.id, 4);

        // Cold-start behavior: If user has zero activity history, redirect directly to AI Recommendations page
        if (!hasActivity || recommendations.length === 0) {
            return res.redirect('/customer/ai-recommendations');
        }

        const [wishlistIds, recentActivity] = await Promise.all([
            db.getUserWishlistIds(req.user.id),
            db.getUserRecentActivity(req.user.id, 5)
        ]);

        res.render('customer/for-you', {
            title: 'For You - Personalized Recommendations',
            user: req.user,
            currentPage: 'for-you',
            recommendations,
            recentActivity,
            wishlistIds
        });
    } catch (err) {
        console.error('Error rendering For You recommendations:', err);
        res.redirect('/customer/dashboard');
    }
};

exports.getForYouApi = async (req, res) => {
    try {
        const { recommendations, hasActivity } = await db.getPersonalizedRecommendations(req.user.id, 4);
        return res.json({
            success: true,
            hasActivity,
            recommendations
        });
    } catch (err) {
        console.error('Error fetching recommendations API:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch recommendations' });
    }
};

exports.renderTrending = async (req, res) => {
    try {
        const [mostTried, mostWishlisted, trendingShapes, comparedPairs] = await Promise.all([
            db.getMostTriedFrames(30, 5),
            db.getMostWishlistedFrames(30, 5),
            db.getTrendingShapes(30, 5),
            db.getFrequentlyComparedPairs(30, 5)
        ]);

        res.render('customer/trending', {
            title: 'Trending & Popular',
            user: req.user,
            currentPage: 'trending',
            mostTried,
            mostWishlisted,
            trendingShapes,
            comparedPairs
        });
    } catch (err) {
        console.error('Error rendering trending page:', err);
        res.redirect('/customer/dashboard');
    }
};

// ==========================================
// Phase 5: JSON API Endpoints for Vue/AJAX
// ==========================================

exports.getFramesApi = async (req, res) => {
    try {
        const allowedSorts = ['price_asc', 'price_desc', 'newest', 'availability', 'popularity', 'most_tried'];
        const sortBy = allowedSorts.includes(req.query.sort) ? req.query.sort : '';
        let frames = await db.getAllFramesSorted(sortBy);

        // Optional filtering by search, shape, color, material
        const search = req.query.search ? req.query.search.toLowerCase().trim() : '';
        const shape = req.query.shape ? req.query.shape.toLowerCase().trim() : '';
        const color = req.query.color ? req.query.color.toLowerCase().trim() : '';
        const material = req.query.material ? req.query.material.toLowerCase().trim() : '';

        if (search || shape || color || material) {
            frames = frames.filter(f => {
                if (search && !((f.name || '').toLowerCase().includes(search) || (f.brand || '').toLowerCase().includes(search))) return false;
                if (shape && (f.shape || '').toLowerCase() !== shape) return false;
                if (color && (f.color || '').toLowerCase() !== color) return false;
                if (material && (f.material || '').toLowerCase() !== material) return false;
                return true;
            });
        }

        const wishlistIds = await db.getUserWishlistIds(req.user.id);
        return res.json({
            success: true,
            total: frames.length,
            frames,
            wishlistIds
        });
    } catch (err) {
        console.error('Error in getFramesApi:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch frames' });
    }
};

exports.getFrameDetailsApi = async (req, res) => {
    try {
        const frameId = parseInt(req.params.id, 10);
        if (isNaN(frameId)) {
            return res.status(400).json({ success: false, error: 'Invalid frame ID' });
        }

        const frame = await db.getFrameById(frameId);
        if (!frame) {
            return res.status(404).json({ success: false, error: 'Frame not found' });
        }

        const [wishlistIds, similarFrames, reviews, reviewStats, userReview] = await Promise.all([
            db.getUserWishlistIds(req.user.id),
            db.getSimilarFrames(frame.id, 4),
            db.getFrameReviews(frame.id, 5, 0),
            db.getFrameReviewStats(frame.id),
            db.getUserReviewForFrame(req.user.id, frame.id)
        ]);

        return res.json({
            success: true,
            frame,
            isWishlisted: wishlistIds.includes(frame.id),
            similarFrames,
            reviews,
            reviewStats,
            userReview,
            isEligibleToReview: true
        });
    } catch (err) {
        console.error('Error in getFrameDetailsApi:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch frame details' });
    }
};

exports.getCartApi = async (req, res) => {
    try {
        const cartItems = await db.getUserCart(req.user.id);
        let subtotal = 0;
        let totalItemCount = 0;
        cartItems.forEach(item => {
            subtotal += item.price * item.quantity;
            totalItemCount += item.quantity;
        });

        const deliveryThreshold = 200.00;
        const flatDeliveryFee = 5.00;
        const deliveryCharge = (cartItems.length > 0 && subtotal < deliveryThreshold) ? flatDeliveryFee : 0;
        const totalAmount = subtotal + deliveryCharge;

        return res.json({
            success: true,
            cart: cartItems,
            summary: {
                subtotal,
                deliveryCharge,
                totalAmount,
                totalItemCount,
                deliveryThreshold,
                freeDeliveryRemaining: Math.max(0, deliveryThreshold - subtotal),
                hasFreeDelivery: subtotal >= deliveryThreshold
            }
        });
    } catch (err) {
        console.error('Error in getCartApi:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch cart' });
    }
};

exports.getWishlistApi = async (req, res) => {
    try {
        const [wishlistIds, frames] = await Promise.all([
            db.getUserWishlistIds(req.user.id),
            db.getUserWishlist(req.user.id)
        ]);
        return res.json({
            success: true,
            wishlistIds,
            frames
        });
    } catch (err) {
        console.error('Error in getWishlistApi:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch wishlist' });
    }
};

exports.toggleWishlistApi = async (req, res) => {
    try {
        const frameId = parseInt(req.body.frameId, 10);
        if (isNaN(frameId)) {
            return res.status(400).json({ success: false, error: 'Valid frameId is required' });
        }

        const wishlistIds = await db.getUserWishlistIds(req.user.id);
        const isCurrentlyWishlisted = wishlistIds.includes(frameId);

        if (isCurrentlyWishlisted) {
            await db.removeFromWishlist(req.user.id, frameId);
        } else {
            await db.addToWishlist(req.user.id, frameId);
        }

        const updatedWishlistIds = await db.getUserWishlistIds(req.user.id);
        return res.json({
            success: true,
            frameId,
            isWishlisted: !isCurrentlyWishlisted,
            wishlistCount: updatedWishlistIds.length,
            wishlistIds: updatedWishlistIds
        });
    } catch (err) {
        console.error('Error in toggleWishlistApi:', err);
        return res.status(500).json({ success: false, error: 'Failed to toggle wishlist' });
    }
};

exports.getOrdersApi = async (req, res) => {
    try {
        const orders = await db.getUserOrders(req.user.id);
        return res.json({
            success: true,
            total: orders.length,
            orders
        });
    } catch (err) {
        console.error('Error in getOrdersApi:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch orders' });
    }
};
