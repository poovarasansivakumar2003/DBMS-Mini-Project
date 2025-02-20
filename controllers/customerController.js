const pool = require("../db");

const isCustomer = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'customer') {
        return res.redirect('/login');
    }
    next();
};

exports.getCustomerDashboard = [isCustomer, (req, res) => {
    res.render('customerDashboard', { 
        pagetitle:`Customer Panel - ${req.session.user.username}`, 
        username: req.session.user.username,
        profile: "customer"
    });
}];
