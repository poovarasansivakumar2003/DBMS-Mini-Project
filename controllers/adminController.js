const pool = require('../db'); 
const multer = require('multer');
const path = require('path');

// Show Admin Dashboard
exports.showDashboard = (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }
    res.render('adminDashboard', { 
        pagetitle: `Admin Panel - ${req.session.user.username}`, 
        username: req.session.user.username,
        profile: "admin"
    });
};

// Define storage for uploading images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/img/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// View Medicines
exports.showMedicines = (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }
    try {
        pool.query('SELECT * FROM medicines', (err, results) => {
            if (err) {
                console.error(err);
                return res.render("500", {
                    username: req.session.user ? req.session.user.username : null,
                    profile: "admin",
                    pagetitle: "Internal Server Error",
                    error: 'Database error. Please try again. ' + err.message 
                });
            }
            res.render("medicinesDetails", {
                username: req.session.user.username,
                profile: "admin",
                pagetitle: "Medicines Details", 
                medicines: results
            });
        });
    } catch (err) {
        console.error(err);
        return res.render("500", {
            username: req.session.user ? req.session.user.username : null,
            profile: "admin",
            pagetitle: "Internal Server Error",
            error: 'Database error. Please try again. ' + err.message 
        });
    }
};

// Add New Medicine
exports.addMedicine = [
    upload.single('medicine_img_url'),
    (req, res) => {
        if (!req.session.user || req.session.user.role !== 'admin') {
            return res.redirect('/login');
        }

        const { medicine_name, medicine_composition, medicine_price, medicine_expiry_date } = req.body;
        const imgUrl = req.file ? req.file.path : null;
        
        const query = `INSERT INTO medicines (medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_img_url) 
                       VALUES (?, ?, ?, ?, ?)`;

        pool.query(query, [medicine_name, medicine_composition, medicine_price, medicine_expiry_date, imgUrl], (err, result) => {
            if (err) {
                console.error(err);
                return res.render("500", {
                    username: req.session.user ? req.session.user.username : null,
                    profile: "admin",
                    pagetitle: "Internal Server Error",
                    error: 'Database error. Please try again. ' + err.message 
                });
            }
            res.redirect('/admin/adminDashboard');
        });
    }
];

// Delete Medicine
exports.deleteMedicine = (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }

    const { id } = req.query;
    pool.query('DELETE FROM medicines WHERE id = ?', [id], (err, result) => {
        if (err) {
            console.error(err);
            return res.render("500", {
                username: req.session.user ? req.session.user.username : null,
                profile: "admin",
                pagetitle: "Internal Server Error",
                error: 'Database error. Please try again. ' + err.message 
            });
        }
        res.redirect('/admin/adminDashboard');
    });
};

// View Customers
exports.showCustomers = (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }

    pool.query('SELECT * FROM customers', (err, results) => {
        if (err) {
            console.error(err);
            return res.render("500", {
                username: req.session.user ? req.session.user.username : null,
                profile: "admin",
                pagetitle: "Internal Server Error",
                error: 'Database error. Please try again. ' + err.message 
            });
        }
        res.render("customers", {
            username: req.session.user ? req.session.user.username : null,
            profile: "admin",
            pagetitle: "Customer Details", 
            customers: results
        });
    });
};