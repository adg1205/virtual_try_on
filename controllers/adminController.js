// Admin Controller - Handles rendering of all admin pages

exports.renderDashboard = (req, res) => {
    res.render('admin/dashboard', { title: 'Admin Dashboard', user: req.user, currentPage: 'dashboard' });
};

exports.renderManageFrames = (req, res) => {
    res.render('admin/manage-frames', { title: 'Manage Frames', user: req.user, currentPage: 'manage-frames' });
};

exports.renderAddFrame = (req, res) => {
    res.render('admin/add-frame', { title: 'Add Frame', user: req.user, currentPage: 'add-frame' });
};

exports.renderEditFrame = (req, res) => {
    res.render('admin/edit-frame', { title: 'Edit Frame', user: req.user, currentPage: 'edit-frame', frameId: req.params.id });
};

exports.renderManageCategories = (req, res) => {
    res.render('admin/manage-categories', { title: 'Manage Categories', user: req.user, currentPage: 'manage-categories' });
};

exports.renderManageStock = (req, res) => {
    res.render('admin/manage-stock', { title: 'Manage Stock', user: req.user, currentPage: 'manage-stock' });
};

exports.renderManageLensOptions = (req, res) => {
    res.render('admin/manage-lens-options', { title: 'Manage Lens Options', user: req.user, currentPage: 'manage-lens-options' });
};

exports.renderManageOrders = (req, res) => {
    res.render('admin/manage-orders', { title: 'Manage Orders', user: req.user, currentPage: 'manage-orders' });
};

exports.renderManagePayments = (req, res) => {
    res.render('admin/manage-payments', { title: 'Manage Payments', user: req.user, currentPage: 'manage-payments' });
};

exports.renderManageCustomers = (req, res) => {
    res.render('admin/manage-customers', { title: 'Manage Customers', user: req.user, currentPage: 'manage-customers' });
};

exports.renderManageStoreLocations = (req, res) => {
    res.render('admin/manage-store-locations', { title: 'Manage Store Locations', user: req.user, currentPage: 'manage-store-locations' });
};

exports.renderReportsAnalytics = (req, res) => {
    res.render('admin/reports-analytics', { title: 'Reports & Analytics', user: req.user, currentPage: 'reports-analytics' });
};

exports.renderAdminProfile = (req, res) => {
    res.render('admin/profile', { title: 'Admin Profile', user: req.user, currentPage: 'profile' });
};
