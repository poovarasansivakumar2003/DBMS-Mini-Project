const bcrypt = require('bcryptjs');
const pool = require("../db");

exports.getLoginPage = (req, res) => {
    res.render('login', {
        pagetitle: 'Login',
        profile: "login",
        error: req.query.error || null,
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
            return res.redirect('/login?error=Invalid credentials');
        }

        const user = rows[0];
        const passwordField = role === 'admin' ? 'admin_password' : 'customer_password';

        if (!await bcrypt.compare(password.trim(), user[passwordField].trim())) {
            return res.redirect('/login?error=Invalid credentials');
        }

        req.session.user = { 
            username: role === 'admin' ? user.admin_username : user.customer_name, role 
        };
        
        res.redirect(role === 'admin' ? '/admin/adminDashboard' : '/customer/customerDashboard');
    } catch (err) {
        console.error("Login error:", err);
        res.redirect('/login?error=Server error');
    }
};

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
};