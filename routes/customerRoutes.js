const express = require('express');
const customerController = require('../controllers/customerController');
const router = express.Router();

// Session check middleware
const checkSession = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

// Admin check middleware
const checkCustomer = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'customer') {
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
router.use(checkCustomer);

router.get('/customerDashboard', customerController.getCustomerDashboard);
router.post('/update/customerDashboard', customerController.updateCustomer); 
router.get("/downloadCard/:filename", customerController.downloadCustomerCard);
router.get('/download-invoice/:invoiceNo', customerController.downloadInvoice);

router.post("/customerDashboard/address/add", customerController.addAddress);
router.post("/customerDashboard/feedback/add", customerController.addFeedback);

router.post("/customerDashboard/address/deleteOrEdit", customerController.deleteOrEditAddress);
router.post("/customerDashboard/feedback/deleteOrEdit", customerController.deleteOrEditFeedback);

router.post("/customerDashboard/purchase", customerController.purchaseMedicine);

module.exports = router;