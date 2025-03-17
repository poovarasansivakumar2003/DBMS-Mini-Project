const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Session check middleware
const checkSession = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

// Admin check middleware
const checkAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(400).render('400', {
            username: req.session.user?.username,
            profile: req.session.user?.role,
            pagetitle: 'Unauthorized Access',
            error: 'Access denied'
        });
    }
    next();
};

// Basic routes
router.use(checkSession);
router.use(checkAdmin);

router.get('/customer/photo/:filename', adminController.getCustomerPhoto);
router.get('/adminDashboard', adminController.getAdminDashboard);
router.post('/adminDashboard/addMedicine', adminController.addMedicine);
router.post('/adminDashboard/editDeleteMedicine', adminController.deleteOrEditMedicine);
router.post('/adminDashboard/editDeleteCustomer', adminController.deleteOrEditCustomer);
router.post('/processOrder', adminController.processOrder);

module.exports = router;