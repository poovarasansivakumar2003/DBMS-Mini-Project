const pool = require('../db');
const multer = require('multer');
const path = require('path');

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

exports.getAdminDashboard = (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }
    res.render('adminDashboard', { 
        pagetitle: `Admin Panel - ${req.session.user.username}`, 
        username: req.session.user.username,
        profile: "admin",
    });
};


// View Medicines with Pagination
exports.showMedicines = async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }

    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const offset = (page - 1) * limit;

        // Fetch medicines
        const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM medicines');
        const [medicines] = await pool.query('SELECT * FROM medicines LIMIT ? OFFSET ?', [limit, offset]);

        const totalPages = Math.ceil(total / limit);

        res.render("medicinesDetails", {
            username: req.session.user.username,
            profile: "admin",
            pagetitle: "Medicines Details",
            medicines: medicines || [],
            currentPage: page,
            totalPages
        });

    } catch (err) {
        console.error(err);
        res.render("500", {
            username: req.session.user?.username,
            profile: "admin",
            pagetitle: "Internal Server Error",
            error: 'Database error. ' + err.message
        });
    }
};


// Add New Medicine
exports.addMedicine = [upload.single('medicine_img_url'), async (req, res) => {
        if (!req.session.user || req.session.user.role !== 'admin') {
            return res.redirect('/login');
        }

        const { medicine_name, medicine_composition, medicine_price, medicine_expiry_date } = req.body;
        const imgUrl = req.file ? req.file.path.replace('public/img/medicinesImg', '') : null;

        try {
            await pool.query(
                `INSERT INTO medicines (medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_img_url) 
                 VALUES (?, ?, ?, ?, ?)`, 
                [medicine_name, medicine_composition, medicine_price, medicine_expiry_date, imgUrl]
            );
            res.redirect('/medicinesDetails');
        } catch (err) {
            console.error(err);
            res.render("500", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Internal Server Error",
                error: 'Database error. ' + err.message
            });
        }
    }
];

// Edit Medicine
exports.editMedicine = async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }

    const { medicine_id, medicine_name, medicine_composition, medicine_price, medicine_expiry_date } = req.body;

    try {
        await pool.query(
            `UPDATE medicines SET medicine_name = ?, medicine_composition = ?, medicine_price = ?, medicine_expiry_date = ? WHERE medicine_id = ?`,
            [medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_id]
        );
        res.redirect('/medicinesDetails');
    } catch (err) {
        console.error(err);
        res.render("500", {
            username: req.session.user?.username,
            profile: "admin",
            pagetitle: "Internal Server Error",
            error: 'Database error. ' + err.message
        });
    }
};

// Delete Medicine
exports.deleteMedicine = async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }

    const { id } = req.query;
    try {
        await pool.query('DELETE FROM medicines WHERE medicine_id = ?', [id]);
        res.redirect('/medicinesDetails');
    } catch (err) {
        console.error(err);
        res.render("500", {
            username: req.session.user?.username,
            profile: "admin",
            pagetitle: "Internal Server Error",
            error: 'Database error. ' + err.message
        });
    }
};

// View Customers
exports.showCustomers = async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }

    try {
        const [customers] = await pool.query('SELECT * FROM customers');  
        console.log("Customers fetched:", customers);

        res.render('adminDashboard', { 
            pagetitle: `Admin Panel - ${req.session.user.username}`, 
            username: req.session.user.username,
            profile: "admin",
            customers: customers || []
        });
    } catch (err) {
        console.error(err);
        res.render("500", {
            username: req.session.user?.username,
            profile: "admin",
            pagetitle: "Internal Server Error",
            error: 'Database error. ' + err.message
        });
    }
};