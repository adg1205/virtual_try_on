const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// All routes here are already protected by verifyToken + requireRole('admin') in indexRoutes.js

router.get('/dashboard', adminController.renderDashboard);
router.get('/manage-frames', adminController.renderManageFrames);
router.get('/add-frame', adminController.renderAddFrame);
router.get('/edit-frame/:id', adminController.renderEditFrame);
router.get('/manage-categories', adminController.renderManageCategories);
router.get('/manage-stock', adminController.renderManageStock);
router.get('/manage-lens-options', adminController.renderManageLensOptions);
router.get('/manage-orders', adminController.renderManageOrders);
router.get('/manage-payments', adminController.renderManagePayments);
router.get('/manage-customers', adminController.renderManageCustomers);
router.get('/manage-store-locations', adminController.renderManageStoreLocations);
router.get('/reports-analytics', adminController.renderReportsAnalytics);
router.get('/profile', adminController.renderAdminProfile);

module.exports = router;
