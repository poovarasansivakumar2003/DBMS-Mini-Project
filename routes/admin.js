const express = require('express');
// const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require("../db");
const router = express.Router();

// Login Page
router.get('/login', (req, res) => {
    res.render('login', { 
        pagetitle: 'Login', 
        path: '/login', 
        error: req.query.error || null,
        admin: req.session ? req.session.admin : null  
    });
});

// Handle Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        console.log("Received login request for:", username); // Debugging
        // Fetch admin from the database
        const [rows] = await pool.query('SELECT * FROM admin WHERE admin_username = ?', [username]);

        if (rows.length === 0) {
            console.log("Admin not found"); // Debugging
            return res.redirect('/login?error=Invalid credentials');
        }

        const admin = rows[0];

        // Compare hashed password
        const isMatch = await bcrypt.compare(password.trim(), admin.admin_password.trim());
        if (!isMatch) {
            console.log("Password does not match"); // Debugging
            console.log("Entered Password:", password);
            console.log("Stored Hashed Password:", admin.admin_password);
            console.log("Password Match Result:", isMatch);
            return res.redirect('/login?error=Invalid credentials');
        }

        if (!req.session) {
            console.log("Session not initialized!"); // Debugging
            return res.redirect('/login?error=Session not initialized');
        }

        // Store session data
        req.session.admin = { username: admin.admin_username };
        console.log("Login successful, session set."); // Debugging

        res.redirect('/admin/adminDashboard'); 
    } catch (err) {
        console.error("Login error:", err);
        res.redirect('/login?error=Server error');
    }
});

// Logout Route
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

router.get('/adminDashboard', (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin/login');
    }
    res.render('adminDashboard', { 
        pagetitle: req.session.admin.username, 
        path: '/adminDashboard' ,
        admin_username: req.session.admin.username 
    });
});

// Route to add a new medicine
router.post("/admin/add-medicine", async (req, res) => {
    try {
        const { medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_img_url } = req.body;

        const [result] = await pool.query(
            "INSERT INTO medicines (medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_img_url) VALUES (?, ?, ?, ?, ?)",
            [medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_img_url]
        );

        res.status(201).json({ message: "Medicine added successfully", medicine_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to delete a medicine
router.delete("/medicines/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query("DELETE FROM medicines WHERE medicine_id = ?", [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Medicine not found" });
        }

        res.json({ message: "Medicine deleted successfully!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
