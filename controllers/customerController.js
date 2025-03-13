const fs = require('fs');
const pool = require('../db');
const multer = require('multer');
const path = require('path');

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
    cb(null, true);
};

const uploadCustomer = multer({ storage: customerStorage, fileFilter });

const isCustomer = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'customer') {
        return res.redirect('/login');
    }
    next();
};

exports.getCustomerDashboard = [isCustomer, async (req, res) => {
    try {
        const customerId = req.session.customerId;

        // Fetch customer details
        const [customerResult] = await pool.query('SELECT * FROM customers WHERE customer_id = ?', [customerId]);

        if (!customerResult.length) {
            return res.status(404).render("404", {
                profile: req.session.user?.role,
                username: req.session.user?.username,
                pagetitle:"Page Not Found",
                error: "Customer not found"
            });
        }
        const customer = customerResult[0];

        // Fetch available medicines
        const [medicines] = await pool.query('SELECT * FROM medicines');

        const [purchases] = await pool.query(`
            SELECT p.purchase_id, p.purchased_quantity, p.total_amt, p.purchase_date, 
                   a.admin_username, m.medicine_name, s.supplier_name
            FROM purchases p
            JOIN medicines m ON p.medicine_id = m.medicine_id
            JOIN admin a ON p.admin_username = a.admin_username
            JOIN suppliers s ON p.supplier_id = s.supplier_id
            WHERE p.customer_id = ?
            ORDER BY p.purchase_date DESC
        `, [customerId]);
        

        res.render('customerDashboard', {
            pagetitle: `Customer Panel - ${req.session.user.username}`,
            username: req.session.user.username,
            profile: "customer",
            medicines,
            customer,
            purchases
        });
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).render("500", {
            username: req.session.user?.username,
            profile: "customer",
            pagetitle: "Internal Server Error",
            error: err.message
        });
    }
}];

exports.updateCustomer = [isCustomer, uploadCustomer.single('customer_photo'), async (req, res) => {
    try {
        const customerId = req.session.customerId;
        const { customer_name, customer_email, customer_ph_no, customer_address, customer_feedback, customer_balance_amt } = req.body;

        // Fetch existing customer data
        const [existingCustomer] = await pool.query('SELECT customer_photo FROM customers WHERE customer_id = ?', [customerId]);

        let newPhotoPath = existingCustomer[0]?.customer_photo; // Default to existing photo

        if (req.file) {
            const ext_cust = path.extname(req.file.originalname);
            const newFileName_cust = `${customerId}_photo${ext_cust}`;
            newPhotoPath = path.join('uploads/customersPhotos', newFileName_cust);

            // Move and rename the uploaded file
            await fs.promises.rename(
                req.file.path,
                path.join(__dirname, '../private', newPhotoPath)
            );

            // Delete old photo if it exists and is not the default
            if (existingCustomer[0]?.customer_photo && !existingCustomer[0].customer_photo.includes('default_photo.jpg')) {
                const oldPath = path.join(__dirname, '../private', existingCustomer[0].customer_photo);
                try {
                    if (fs.existsSync(oldPath)) {
                        await fs.promises.unlink(oldPath);
                    }
                } catch (err) {
                    console.error("Error deleting old photo:", err);
                }
            }
        }

        await pool.query(
            `UPDATE customers SET customer_name = ?, customer_email = ?, customer_ph_no = ?, 
                    customer_address = ?, customer_feedback = ?, customer_balance_amt = ?, 
                    customer_photo = ? WHERE customer_id = ?`,
            [customer_name, customer_email, customer_ph_no, customer_address, customer_feedback, customer_balance_amt, newPhotoPath, customerId]
        );

        res.render("success", {
            pdfName: null,
            username: req.session.user?.username,
            profile: "customer",
            pagetitle: "Success",
            message: "Your Profile updated successfully!"
        });
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).render("500", {
            username: req.session.user?.username,
            profile: "customer",
            pagetitle: "Internal Server Error",
            error: err.message
        });
    }
}];

exports.purchaseMedicine = [isCustomer, async (req, res) => {
    try {
        const { medicineId, quantity } = req.body;
        const customerId = req.session.customerId;

        // Fetch medicine price
        const [medicine] = await pool.query('SELECT medicine_price FROM medicines WHERE medicine_id = ?', [medicineId]);
        if (!medicine.length) {
            return res.status(400).send("Invalid medicine ID");
        }

        const total_amt = medicine[0].medicine_price * quantity;

        // Insert purchase record
        await pool.query(
            'INSERT INTO purchases (customer_id, medicine_id, purchased_quantity, total_amt) VALUES (?, ?, ?, ?)',
            [customerId, medicineId, quantity, total_amt]
        );

        res.render("success", {
            pdfName: null,
            username: req.session.user?.username,
            profile: "customer",
            pagetitle: "Success",
            message: "Added to cart, wait for admin approval"
        });
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).render("500", {
            username: req.session.user?.username,
            profile: "customer",
            pagetitle: "Internal Server Error",
            error: err.message
        });
    }
}];