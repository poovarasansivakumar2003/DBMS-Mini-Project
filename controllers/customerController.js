const fs = require('fs');
const pool = require('../db');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, "../uploads");
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        // Accept only image files
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

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
        const [customerResult] = await pool.query('SELECT c.*, ca.* FROM customers c LEFT JOIN customer_addresses ca on c.customer_id = ca.customer_id WHERE customer_id = ?', [customerId]);

        if (!customerResult.length) {
            return res.status(404).render("404", {
                profile: req.session.user?.role,
                username: req.session.user?.username,
                pagetitle: "Page Not Found",
                error: "Customer not found"
            });
        }
        const customer = customerResult[0];

        // Fetch available medicines
        const [medicines] = await pool.query('SELECT * FROM medicines');

        const [invoice] = await pool.query(`
            SELECT 
                i.invoice_no, 
                i.invoice_time, 
                a.admin_username, 
                m.medicine_name, 
                m.medicine_composition, 
                s.supplier_name, 
                m.medicine_expiry_date, 
                m.medicine_price, 
                p.purchased_quantity, 
                p.total_amt, 
                ps.actual_amt_to_pay,
                c.customer_balance_amt, 
                i.total_amt_to_pay,
                i.discount,
                i.net_total
                py.payment_amt AS amount_paid, 
                py.payment_time AS payment_date,
                i.balance    
            FROM invoice i
            JOIN purchase_sessions ps ON i.purchase_session_id = ps.purchase_session_id  -- Link invoices to sessions
            JOIN purchases p ON ps.customer_id = p.customer_id  -- Link purchases via sessions
            JOIN medicines m ON p.medicine_id = m.medicine_id
            LEFT JOIN suppliers s ON p.supplier_id = s.supplier_id  -- Supplier may be NULL
            JOIN customers c ON ps.customer_id = c.customer_id  -- Link to customers
            LEFT JOIN admin a ON i.admin_username = a.admin_username  -- Admin may be NULL
            LEFT JOIN payments py ON i.payment_id = py.payment_id  -- Link to payments
            WHERE ps.customer_id = ?
            ORDER BY i.invoice_time DESC
        `, [customerId]);

        res.render('customerDashboard', {
            pagetitle: `Customer Panel - ${req.session.user.username}`,
            username: req.session.user.username,
            profile: "customer",
            medicines,
            customer,
            invoice
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

exports.updateCustomer = [isCustomer, async (req, res) => {
    upload.single("customer_photo")(req, res, async (err) => {
        if (err) {
            console.error("Multer error:", err);
            return res.status(500).render("500", {
                profile: req.session.user?.role,
                username: req.session.user?.username,
                pagetitle: "Internal Server Error",
                error: "Multer error"
            });
        }

        try {
            const customerId = req.session.customerId;
            const { customer_name, customer_email, customer_ph_no, customer_photo, customer_password, street, city, state, zip_code, address_type, rating, feedback_text } = req.body;

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
            return res.status(404).render("400", {
                profile: req.session.user?.role,
                username: req.session.user?.username,
                pagetitle: "Bad Request",
                error: "Invalid medicine ID"
            });
        }

        // Insert purchase record
        await pool.query(
            'INSERT INTO purchases (customer_id, medicine_id, purchased_quantity) VALUES (?, ?, ?)',
            [customerId, medicineId, quantity]
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