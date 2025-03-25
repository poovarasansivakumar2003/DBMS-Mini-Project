const bcrypt = require('bcryptjs');
const pool = require("../db");
const nodemailer = require('nodemailer');
const crypto = require('crypto');

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
                profile: req.session.user?.role,
                username: req.session.user?.username,
                error: "Invalid credentials"
            });
        }

        // Store session data
        req.session.customerId = user.customer_id;
        req.session.admin = user.admin_username; 
        req.session.user = {
            username: role === 'admin' ? user.admin_username : user.customer_name,
            id: role === 'admin' ? user.admin_username : user.customer_id,
            role
        };

        return res.redirect(role === 'admin' ? '/admin/adminDashboard' : '/customer/customerDashboard');

    } catch (err) {
        console.error("Login error:", err);
        return res.status(500).render("login", {
            pagetitle: 'Login',
            profile: req.session.user?.role,
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

// Store OTP temporarily
const otpStore = new Map();

exports.forgotPassword = async (req, res) => {
    try {
        const { contact } = req.body;
        req.session.otpRequested = contact;

        if (!contact) {
            return res.render("forgotPassword", {
                pagetitle: 'Forgot Password',
                profile: req.session.user?.role,
                username: req.session.user?.username,
                error: "Please provide an email or phone number"
            });
        }

        const query = contact.includes('@') ?
            'SELECT * FROM customers WHERE customer_email = ?' :
            'SELECT * FROM customers WHERE customer_ph_no = ?';

        const [rows] = await pool.query(query, [contact]);

        if (rows.length === 0) {
            return res.render("forgotPassword", {
                pagetitle: 'Forgot Password',
                profile: req.session.user?.role,
                username: req.session.user?.username,
                error: "User not found"
            });
        }

        // Generate OTP
        const otp = crypto.randomInt(100000, 999999);
        otpStore.set(contact, { otp, expires: Date.now() + 5 * 60 * 1000 });

        if (contact.includes('@')) {
            const transporter = nodemailer.createTransport({
                service: process.env.EMAIL_SERVICE || 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: contact,
                subject: 'Password Reset OTP',
                text: `Your OTP for password reset is: ${otp}. It is valid for 5 minutes.`
            });
        } else {
            console.log(`SMS OTP would be sent to ${contact}: ${otp}`);
        }

        return res.render("otpVerification", {
            pagetitle: 'OTP Verification',
            profile: req.session.user?.role,
            username: req.session.user?.username,
            error: null,
            contact
        });

    } catch (err) {
        console.error("Forgot Password Error:", err);
        return res.render("forgotPassword", {
            pagetitle: 'Forgot Password',
            profile: req.session.user?.role,
            username: req.session.user?.username,
            error: "An unexpected error occurred. Please try again."
        });
    }
};

exports.verifyOtp = (req, res) => {
    if (!req.session.otpRequested) {
        return res.redirect('/forgotPassword');
    }

    const { contact, otp } = req.body;

    // Check if OTP exists
    if (!otpStore.has(contact)) {
        return res.render("otpVerification", {
            pagetitle: 'OTP Verification',
            profile: req.session.user?.role,
            username: req.session.user?.username,
            error: "Invalid or expired OTP",
            contact
        });
    }

    // Check OTP expiration
    const otpData = otpStore.get(contact);
    if (Date.now() > otpData.expires) {
        otpStore.delete(contact);
        return res.render("otpVerification", {
            pagetitle: 'OTP Verification',
            profile: req.session.user?.role,
            username: req.session.user?.username,
            error: "OTP has expired",
            contact
        });
    }

    // Check OTP value
    if (otpData.otp != otp) {
        return res.render("otpVerification", {
            pagetitle: 'OTP Verification',
            profile: req.session.user?.role,
            username: req.session.user?.username,
            error: "Invalid OTP",
            contact
        });
    }



    // OTP is correct; proceed to reset password
    otpStore.delete(contact); // Remove OTP from store
    req.session.otpVerified = contact; // ✅ Allow access to reset password page
    return res.render("resetPassword", {
        pagetitle: 'Reset Password',
        profile: req.session.user?.role,
        username: req.session.user?.username,
        error: null,
        contact
    });
};

exports.resetPassword = async (req, res) => {
    if (!req.session.otpRequested) {
        return res.redirect('/forgotPassword');
    }

    const { contact, password, confirmPassword } = req.body;

    // Validate password
    if (!password || password.length < 8) {
        return res.render("resetPassword", {
            pagetitle: 'Reset Password',
            profile: req.session.user?.role,
            username: req.session.user?.username,
            error: "Password must be at least 8 characters",
            contact
        });
    }

    // Check if passwords match
    if (password !== confirmPassword) {
        return res.render("resetPassword", {
            pagetitle: 'Reset Password',
            profile: req.session.user?.role,
            username: req.session.user?.username,
            error: "Passwords do not match",
            contact
        });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const query = contact.includes('@') ?
            'UPDATE customers SET customer_password = ? WHERE customer_email = ?' :
            'UPDATE customers SET customer_password = ? WHERE customer_ph_no = ?';

        const [result] = await pool.query(query, [hashedPassword, contact]);

        if (result.affectedRows === 0) {
            return res.render("resetPassword", {
                pagetitle: 'Reset Password',
                profile: req.session.user?.role,
                username: req.session.user?.username,
                error: "Failed to update password. User not found.",
                contact
            });
        }

        // Send confirmation email if the contact is an email
        if (contact.includes('@')) {
            const transporter = nodemailer.createTransport({
                service: process.env.EMAIL_SERVICE || 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: contact,
                subject: 'Password Reset Confirmation',
                text: `Your password has been successfully reset. If you did not request this change, please contact support immediately.`
            });
        } 

        return res.render("success", {
            profile: req.session.user?.role,
            username: req.session.user?.username,
            pagetitle: "Success",
            message: "Password has been reset successfully. Please login with your new password."
        });
    } catch (err) {
        console.error("Reset Password Error:", err);
        return res.render("resetPassword", {
            pagetitle: 'Reset Password',
            profile: req.session.user?.role,
            username: req.session.user?.username,
            error: err.message,
            contact
        });
    }
};