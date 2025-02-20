const pool = require("../db");

exports.getCustomerDashboard = (req, res) => {
    if (!req.session.user || req.session.user.role !== 'customer') {
        return res.redirect('/login');
    }
    res.render('customerDashboard', { 
        pagetitle:`Customer Panel - ${req.session.user.username}`, 
        username: req.session.user.username,
        profile: "customer"
    });
};
