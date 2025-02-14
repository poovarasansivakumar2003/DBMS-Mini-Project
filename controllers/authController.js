const bcrypt = require('bcryptjs');
const pool = require("../db");

exports.getLoginPage = (req, res) => {
    res.render('login', {
        pagetitle: 'Login',
        profile: "login",
        user: req.session ? req.session.user : null,
        username: req.session.user ? req.session.user.username : null
    });
};

exports.handleLogin = async (req, res) => {
    const { username, password, role } = req.body;
    try {
        let query = role === 'admin' ? 'SELECT * FROM admin WHERE admin_username = ?' : 'SELECT * FROM customers WHERE customer_email = ?';
        const [rows] = await pool.query(query, [username]);
        
        if (rows.length === 0) {
            return res.status(500).render("500", { error: "Invalid credentials" });
        }

        const user = rows[0];
        const passwordField = role === 'admin' ? 'admin_password' : 'customer_password';

        if (!await bcrypt.compare(password.trim(), user[passwordField].trim())) {
            return res.status(500).render("500", { error: "Invalid credentials" });
        }

        req.session.user = { 
            username: role === 'admin' ? user.admin_username : user.customer_name, role 
        };
        
        res.redirect(role === 'admin' ? '/admin/adminDashboard' : '/customer/customerDashboard');

    } catch (err) {
        console.error("Login error:", err);
        res.render('login', {
            pagetitle: 'Login',
            profile: "login",
            error: 'Failed to send message. Please try again later.',
            user: req.session ? req.session.user : null,
            username: req.session.user ? req.session.user.username : null
        });
    }
};

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
};