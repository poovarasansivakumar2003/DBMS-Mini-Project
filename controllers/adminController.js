const fs = require('fs');
const pool = require('../db');
const multer = require('multer');
const path = require('path');

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
    const filePath = path.resolve(__dirname, "../private/uploads/customersPhotos", filename);
    const defaultPhotoPath = path.resolve(__dirname, "../private/uploads/customersPhotos/default_photo.jpg");

    // Validate filename to prevent directory traversal attacks
    if (!filename || !/^[a-zA-Z0-9._-]+$/.test(filename)) {
        return res.status(400).render("400", {
            username: req.session.user?.username,
            profile: "admin",
            pagetitle: "Bad Request",
            error: "Invalid file request"
        });
    }

    // Check if the requested file exists
    if (!fs.existsSync(filePath)) {
        return res.sendFile(defaultPhotoPath);
    }

    res.sendFile(filePath);
}];

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
                error: "All fields are required"
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

        // Check if customer exists before proceeding
        const [existingCustomer] = await pool.query('SELECT customer_photo FROM customers WHERE customer_id = ?', [customer_id]);
        if (!existingCustomer.length) {
            return res.status(404).render("404", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Not Found",
                error: "Customer not found"
            });
        }

        if (action === "delete") {
            // Delete customer and remove image if not default
            const oldPhoto = existingCustomer[0].customer_photo;
            if (oldPhoto && oldPhoto !== 'uploads/customersPhotos/default_photo.jpg') {
                fs.unlink(path.join(__dirname, '../private/', oldPhoto), (err) => {
                    if (err) console.error("Error deleting old image:", err);
                });
            }
            await pool.query('DELETE FROM customers WHERE customer_id = ?', [customer_id]);

        }else if (action === "edit") {

            let imgUrl = req.file ? `../private/uploads/customersPhotos/${req.file.filename}` : null;
        
            if (req.file) {
                // Define new file path with customer_id in filename
                const ext = path.extname(req.file.originalname);
                const newFileName = `${customer_id}_photo${ext}`;
                const newImgPath = `./private/uploads/customersPhotos/${newFileName}`;
        
                // Remove old photo before updating (if it's not the default)
                const oldPhoto = existingCustomer[0].customer_photo;
                if (oldPhoto && oldPhoto !== '../private/uploads/customersPhotos/default_photo.jpg') {
                    try {
                        await fs.promises.unlink(path.join(__dirname, '..', oldPhoto));
                    } catch (err) {
                        console.error("Error deleting old image:", err);
                    }
                }
        
                // Rename uploaded file to match customer_id
                try {
                    await fs.promises.rename(req.file.path, path.join(__dirname, newImgPath));
                } catch (err) {
                    console.error("Error renaming file:", err);
                    return res.status(500).render("500", {
                        username: req.session.user?.username,
                        profile: "admin",
                        pagetitle: "Internal Server Error",
                        error: err.message
                    });
                }
        
                imgUrl = newImgPath; 
            }
        
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
