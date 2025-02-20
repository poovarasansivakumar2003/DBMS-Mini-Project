const bcrypt = require('bcryptjs');
const pool = require("../db");

exports.getLoginPage = (req, res) => {
    res.render('login', {
        pagetitle: 'Login',
        profile: req.session.user?.role || "login",
        username: req.session.user?.username,
        user: req.session?.user || null
    });
};

exports.handleLogin = async (req, res) => {
    const { username, password, role } = req.body;
    try {
        // Select the query based on role
        const query = role === 'admin'
            ? 'SELECT * FROM admin WHERE admin_username = ?'
            : 'SELECT * FROM customers WHERE customer_email = ?';
        
        const [rows] = await pool.query(query, [username]);

        if (rows.length === 0) {
            return res.status(400).render("login", { 
                pagetitle: 'Login', 
                profile: req.session.user?.role || "login",
                username: req.session.user?.username, 
                error: "Invalid credentials" 
            });
        }

        const user = rows[0];
        const passwordField = role === 'admin' ? 'admin_password' : 'customer_password';

        // Ensure passwords match
        const isMatch = await bcrypt.compare(password.trim(), user[passwordField].trim());
        if (!isMatch) {
            return res.status(400).render("login", { 
                pagetitle: 'Login', 
                profile: req.session.user?.role || "login",
                username: req.session.user?.username,
                error: "Invalid credentials" 
            });
        }

        // Store session data
        req.session.user = {
            username: role === 'admin' ? user.admin_username : user.customer_name,
            role
        };
        
        return res.redirect(role === 'admin' ? '/admin/adminDashboard' : '/customer/customerDashboard');

    } catch (err) {
        console.error("Login error:", err);
        return res.status(500).render("login", { 
            pagetitle: 'Login', 
            profile: req.session.user?.role || "login",
            username: req.session.user?.username,
            error: err.message
        });
    }
};

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
};
