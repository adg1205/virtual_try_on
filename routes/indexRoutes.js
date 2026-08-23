const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const pageController = require('../controllers/pageController');
const catalogController = require('../controllers/catalogController');
const authController = require('../controllers/authController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// Import modular route files
const adminRoutes = require('./adminRoutes');
const customerRoutes = require('./customerRoutes');

// Multer Config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/profiles/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

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
router.post('/signup', upload.single('profile_photo'), authController.registerUser);
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
