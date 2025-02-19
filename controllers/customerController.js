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

exports.getMedicines = async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'customer') {
        return res.redirect('/login');
    }
    try {
        pool.query('SELECT * FROM customers', (err, results) => {
        res.render("medicinesDetails", {
            profile: "customer",
            pagetitle: "Medicines Details", 
            medicines: rows, 
            username: req.session.user ? req.session.user.username : null
        });
    });
    } catch(err) {
        console.error(err);
        return  res.render("500", {
            username: req.session.user ? req.session.user.username : null,
            profile: "customer",
            pagetitle: "Internal Server Error",
            error: 'Database error. Please try again.'+ err.message 
        });
    }
};
