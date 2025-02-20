const pool = require('../db');
const multer = require('multer');
const path = require('path');

// Define storage for uploading images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/img/medicinesImg');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }
    next();
};

exports.getAdminDashboard = [isAdmin, (req, res) => {
    res.render('adminDashboard', { 
        pagetitle: `Admin Panel - ${req.session.user.username}`, 
        username: req.session.user.username,
        profile: "admin",
    });
}];

// View Medicines with Pagination
exports.showMedicines = [isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const offset = (page - 1) * limit;

        const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM medicines');
        const [medicines] = await pool.query('SELECT * FROM medicines LIMIT ? OFFSET ?', [limit, offset]);

        res.render("medicinesDetails", {
            username: req.session.user.username,
            profile: "admin",
            pagetitle: "Medicines Details",
            medicines,
            currentPage: page,
            totalPages: Math.ceil(total / limit)
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

// Add New Medicine
exports.addMedicine = [isAdmin, upload.single('medicine_img_url'), async (req, res) => {
    try {
        const { medicine_name, medicine_composition, medicine_price, medicine_expiry_date } = req.body;
        if (!medicine_name || !medicine_composition || !medicine_price || !medicine_expiry_date) {
            return res.status(400).send("All fields are required");
        }

        const imgUrl = req.file ? `/img/medicinesImg/${req.file.filename}` : null;

        await pool.query(
            `INSERT INTO medicines (medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_img_url) 
             VALUES (?, ?, ?, ?, ?)`, 
            [medicine_name, medicine_composition, medicine_price, medicine_expiry_date, imgUrl]
        );
        res.redirect('/medicinesDetails');
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

// Edit Medicine
exports.editMedicine = [isAdmin, async (req, res) => {
    try {
        const { medicine_id, medicine_name, medicine_composition, medicine_price, medicine_expiry_date } = req.body;
        if (!medicine_id || !medicine_name || !medicine_composition || !medicine_price || !medicine_expiry_date) {
            return res.status(400).send("All fields are required");
        }

        await pool.query(
            `UPDATE medicines SET medicine_name = ?, medicine_composition = ?, medicine_price = ?, medicine_expiry_date = ? WHERE medicine_id = ?`,
            [medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_id]
        );
        res.redirect('/medicinesDetails');
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

// Delete Medicine
exports.deleteMedicine = [isAdmin, async (req, res) => {
    try {
        const { id } = req.query;
        if (!id) return res.status(400).send("Medicine ID is required");

        await pool.query('DELETE FROM medicines WHERE medicine_id = ?', [id]);
        res.redirect('/medicinesDetails');
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

// View Customers
exports.showCustomers = [isAdmin, async (req, res) => {
    try {
        const [customers] = await pool.query('SELECT * FROM customers');  
        res.render('adminDashboard', { 
            pagetitle: `Admin Panel - ${req.session.user.username}`, 
            username: req.session.user.username,
            profile: "admin",
            customers,
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
