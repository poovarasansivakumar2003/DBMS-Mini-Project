const fs = require('fs');
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const express = require("express");
const app = express();

// Medicine Image Storage
const medicineStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/img/medicinesImg');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// Customer Photo Storage
const customerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './private/uploads/customersPhotos');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// File Filters (Restrict to Images Only)
const fileFilter = (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.mimetype)) {
        return cb(new Error("Only images (JPEG, JPG, PNG) are allowed!"), false);
    }
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`);
};


// Initialize Multer for Both Uploads
const uploadMedicine = multer({ storage: medicineStorage, fileFilter });
const uploadCustomer = multer({ storage: customerStorage, fileFilter });

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }
    next();
};

// Serve Customer Photos Securely
exports.getCustomerPhoto = [isAdmin, (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../private/uploads/customersPhotos', filename);

    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).render("404", {
            username: req.session.user.username,
            profile: "admin",
            pagetitle: "Not Found",
            error: "Image not found"
        });
    }
}];

app.use("/private/uploads/customersPhotos", express.static(path.join(__dirname, "../private/uploads/customersPhotos")));

exports.getAdminDashboard = [isAdmin, async (req, res) => {
    try {
        const [medicines] = await pool.query('SELECT * FROM medicines');
        const [customers] = await pool.query('SELECT * FROM customers');
        res.render('adminDashboard', {
            pagetitle: `Admin Panel - ${req.session.user.username}`,
            username: req.session.user.username,
            profile: "admin",
            medicines,
            customers
        });
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).render("500", {
            username: req.session.user?.username,
            profile: "admin",
            pagetitle: "Internal Server Error",
            error: err.message
        });
    }
}];

// Add Medicine 
exports.addMedicine = [isAdmin, uploadMedicine.single('medicine_img'), async (req, res) => {
    try {
        const { medicine_name, medicine_composition, medicine_price, medicine_expiry_date } = req.body;
        if (!medicine_name || !medicine_composition || !medicine_price || !medicine_expiry_date) {
            return res.status(400).render("400", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Bad Request",
                error:"All fields are required"
            });
        }

        const imgUrl = req.file ? `img/medicinesImg/${req.file.filename}` : null;

        await pool.query(
            `INSERT INTO medicines (medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_img) 
             VALUES (?, ?, ?, ?, ?)`,
            [medicine_name, medicine_composition, medicine_price, medicine_expiry_date, imgUrl]
        );
        req.flash("success", "Medicine added successfully!");
        res.redirect('/admin');
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).render("500", {
            username: req.session.user?.username,
            profile: "admin",
            pagetitle: "Internal Server Error",
            error: err.message
        });
    }
}];

// Edit or Delete Medicine
exports.deleteOrEditMedicine = [isAdmin, uploadMedicine.single('medicine_img'), async (req, res) => {
    try {
        const { action, medicine_id, medicine_name, medicine_composition, medicine_price, medicine_expiry_date } = req.body;
        
        if (action === "delete") {
            await pool.query('DELETE FROM medicines WHERE medicine_id = ?', [medicine_id]);
        } else if (action === "edit") {
            let imgUrl = req.file ? `img/medicinesImg/${req.file.filename}` : null;
            
            if (imgUrl) {
                await pool.query(
                    `UPDATE medicines SET medicine_name = ?, medicine_composition = ?, medicine_price = ?, medicine_expiry_date = ?, medicine_img = ? WHERE medicine_id = ?`,
                    [medicine_name, medicine_composition, medicine_price, medicine_expiry_date, imgUrl, medicine_id]
                );
            } else {
                await pool.query(
                    `UPDATE medicines SET medicine_name = ?, medicine_composition = ?, medicine_price = ?, medicine_expiry_date = ? WHERE medicine_id = ?`,
                    [medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_id]
                );
            }
        }
        res.redirect('/admin');
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).render("500", {
            username: req.session.user?.username,
            profile: "admin",
            pagetitle: "Internal Server Error",
            error: err.message
        });
    }
}];

// ✅ Edit or Delete Customer (Supports Image Update)
exports.deleteOrEditCustomer = [isAdmin, uploadCustomer.single('customer_photo'), async (req, res) => {
    try {
        const { action, customer_id, customer_name, customer_email, customer_ph_no, customer_address, customer_feedback, customer_balance_amt } = req.body;

        if (action === "delete") {
            await pool.query('DELETE FROM customers WHERE customer_id = ?', [customer_id]);
        } else if (action === "edit") {
            let imgUrl = req.file ? `uploads/customersPhotos/${req.file.filename}` : null;

            if (imgUrl) {
                await pool.query(
                    `UPDATE customers SET customer_name = ?, customer_email = ?, customer_ph_no = ?, customer_address = ?, customer_feedback = ?, customer_balance_amt = ?, customer_photo = ? WHERE customer_id = ?`,
                    [customer_name, customer_email, customer_ph_no, customer_address, customer_feedback, customer_balance_amt, imgUrl, customer_id]
                );
            } else {
                await pool.query(
                    `UPDATE customers SET customer_name = ?, customer_email = ?, customer_ph_no = ?, customer_address = ?, customer_feedback = ?, customer_balance_amt = ? WHERE customer_id = ?`,
                    [customer_name, customer_email, customer_ph_no, customer_address, customer_feedback, customer_balance_amt, customer_id]
                );
            }
        }
        res.redirect('/admin');
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).render("500", {
            username: req.session.user?.username,
            profile: "admin",
            pagetitle: "Internal Server Error",
            error: err.message
        });
    }
}];