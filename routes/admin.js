const express = require('express');
const path = require('path');
const pool = require("../db");
const router = express.Router();

router.get('/login', (req, res, next) => {
    res.render('login',{pagetitle:'Login', path:'/login', error: req.query.error || null });
});

// Handle login form submission
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const [rows] = await pool.query('SELECT * FROM admin WHERE admin_username = ?', [username]);

        if (rows.length === 0) {
            return res.redirect('/login?error=Invalid credentials');
        }

        const admin = rows[0];

        // Uncomment if passwords are hashed
        // const isMatch = await bcrypt.compare(password, admin.admin_password);
        const isMatch = password === admin.admin_password; // For plain text passwords

        if (!isMatch) {
            return res.redirect('/login?error=Invalid credentials');
        }

        // Store session data
        req.session.admin = { username: admin.admin_username };
        
        res.redirect('/'); 
    } catch (err) {
        console.error(err);
        res.redirect('/login?error=Server error');
    }
});

// Logout Route
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});


// Route to add a new medicine
router.post("/medicines", async (req, res) => {
    try {
        const { medicine_name, medicine_composition, medicine_price, medicine_expiry_date } = req.body;

        const [result] = await pool.query(
            "INSERT INTO medicines (medicine_name, medicine_composition, medicine_price, medicine_expiry_date) VALUES (?, ?, ?, ?)",
            [medicine_name, medicine_composition, medicine_price, medicine_expiry_date]
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
