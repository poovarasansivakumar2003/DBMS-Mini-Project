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

router.get('/adminDashboard', adminController.getAdminDashboard);
router.post('/adminDashboard/customer/deleteOrEditCustomer', adminController.deleteOrEditCustomer);
router.post('/adminDashboard/medicine/addMedicine', adminController.addMedicine);
router.post('/adminDashboard/medicine/deleteOrEditMedicine', adminController.deleteOrEditMedicine);
router.post('/adminDashboard/supplier/addSupplier', adminController.addSupplier);
router.post('/adminDashboard/supplier/deleteOrEditSupplier', adminController.deleteOrEditSupplier);
router.post('/adminDashboard/stocks/addStocks', adminController.addStocks);
router.post('/adminDashboard/stocks/deleteOrEditStocks', adminController.deleteOrEditStocks);
router.post("/adminDashboard/cart/addToCart", adminController.purchaseMedicine);
router.post('/adminDashboard/cart/processCart', adminController.processCart);
router.post('/adminDashboard/groupPurchase/processGroupPurchase', adminController.processGroupPurchase);

module.exports = router;