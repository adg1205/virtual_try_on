const express = require('express');
const router = express.Router();
const multer = require('multer');

const pageController = require('../controllers/pageController');
const catalogController = require('../controllers/catalogController');
const authController = require('../controllers/authController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// Import modular route files
const adminRoutes = require('./adminRoutes');
const customerRoutes = require('./customerRoutes');

// Keep uploads in memory until Cloudinary stores them. Vercel functions do not
// provide durable local filesystem storage.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, callback) => {
        const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
        const isSupported = supportedTypes.has(file.mimetype);
        callback(isSupported ? null : new Error('Profile photo must be JPEG, PNG, or WebP.'), isSupported);
    }
});

function acceptProfileUpload(req, res, next) {
    upload.single('profile_photo')(req, res, error => {
        if (!error) return next();
        const message = error.code === 'LIMIT_FILE_SIZE'
            ? 'Profile photo must be 2 MB or smaller.'
            : error.message;
        return res.status(400).send(message);
    });
}

// Public Routes
router.get('/', pageController.renderHome);
router.get('/about', pageController.renderAbout);
router.get('/contact', pageController.renderContact);
router.get('/catalog', catalogController.renderCatalog);

// Auth Pages (GET)
router.get('/login', pageController.renderLogin);
router.get('/signup', pageController.renderSignup);
router.get('/forgot-password', pageController.renderForgotPassword);
router.get('/reset-password/:token', pageController.renderResetPassword);

// Auth Actions (POST/GET)
router.post('/signup', acceptProfileUpload, authController.registerUser);
router.post('/login', authController.loginUser);
router.get('/logout', authController.logoutUser);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);

// Payment Gateway Callbacks (Stripe & SSLCommerz)
const paymentController = require('../controllers/paymentController');
router.get('/customer/payment/stripe/success', paymentController.handleStripeSuccess);
router.get('/customer/payment/stripe/cancel', paymentController.handleStripeCancel);
router.post('/customer/payment/sslcommerz/success', paymentController.handleSSLCommerzSuccess);
router.post('/customer/payment/sslcommerz/fail', paymentController.handleSSLCommerzFail);
router.post('/customer/payment/sslcommerz/cancel', paymentController.handleSSLCommerzCancel);
router.post('/customer/payment/sslcommerz/ipn', paymentController.handleSSLCommerzIPN);

// Protected Dashboard Routes (delegated to modular route files)
router.use('/admin', verifyToken, requireRole('admin'), adminRoutes);
router.use('/customer', verifyToken, requireRole('customer'), customerRoutes);

module.exports = router;
