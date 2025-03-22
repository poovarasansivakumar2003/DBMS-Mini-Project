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
router.get('/download-invoice/:invoiceNo', customerController.downloadInvoice);
// router.post('/customerDashboard/update', customerController.updateCustomer);
// router.get("/customer/downloadCard/:filename", customerController.downloadCustomerCard);

module.exports = router;