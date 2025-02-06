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
        const [rows] = await pool.query("SELECT * FROM medicines");
         const profile = req.session.user ? req.session.user.role : undefined;
        res.render("medicines", {profile, pagetitle: "Medicines", medicines: rows, username: req.session.user ? req.session.user.username : null});
    } catch (err) {
        res.status(500).send(err.message);
    }
};
