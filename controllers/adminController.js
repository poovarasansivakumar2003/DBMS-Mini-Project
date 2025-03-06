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
    cb(null, true);
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
        const [purchases] = await pool.execute(`
            SELECT p.purchase_id, c.customer_name, m.medicine_name, s.supplier_name, p.purchased_quantity, p.total_amt, p.purchase_date 
            FROM purchases p 
            JOIN customers c ON p.customer_id = c.customer_id
            JOIN medicines m ON p.medicine_id = m.medicine_id
            JOIN suppliers s ON p.supplier_id = s.supplier_id
            ORDER BY p.purchase_date DESC;
        `);
        const [suppliers] = await pool.execute(`SELECT * FROM suppliers;`);
        const [stocks] = await pool.execute(`
            SELECT m.medicine_name, s.supplier_name, st.stock_quantity FROM stocks st 
            JOIN medicines m ON st.medicine_id = m.medicine_id 
            JOIN suppliers s ON st.supplier_id = s.supplier_id;
        `);
        const [invoices] = await pool.execute(`
            SELECT i.invoice_no, i.purchase_id, i.discount, i.paid, i.net_total, i.balance, CASE WHEN i.balance > 0 THEN 'Pending' ELSE 'Paid' END AS status FROM invoice i;
        `);
        const [Medicine_Stock_for_Each_Supplier] = await pool.execute(`
            SELECT s.supplier_name, m.medicine_name, st.stock_quantity
            FROM stocks st
            JOIN suppliers s ON st.supplier_id = s.supplier_id
            JOIN medicines m ON st.medicine_id = m.medicine_id;
        `);
        const [Combined_Stock_of_Each_Medicine] = await pool.execute(`
            SELECT m.medicine_name, SUM(st.stock_quantity) AS total_stock
            FROM stocks st
            JOIN medicines m ON st.medicine_id = m.medicine_id
            GROUP BY m.medicine_name;
        `);
        const [Total_Amount_Spent_by_Each_Customer] = await pool.execute(`
            SELECT c.customer_name, SUM(p.total_amt) AS total_spent
            FROM purchases p
            JOIN customers c ON p.customer_id = c.customer_id
            GROUP BY c.customer_name;
        `);

        // Render EJS page with data
        res.render('adminDashboard', {
            pagetitle: `Admin Panel - ${req.session.user.username}`,
            username: req.session.user.username,
            profile: "admin",
            medicines, customers, purchases, suppliers, stocks, invoices,
            Medicine_Stock_for_Each_Supplier,
            Combined_Stock_of_Each_Medicine,
            Total_Amount_Spent_by_Each_Customer
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
        if (!medicine_name || !medicine_composition || !medicine_price || !medicine_expiry_date || !req.file) {
            return res.status(400).render("400", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Bad Request",
                error: "All fields are required"
            });
        }

        const ext_medi = path.extname(req.file.originalname);
        const newFileName_medi = `${medicine_name}${ext_medi}`;
        newFilePath = `/img/medicinesImg/${newFileName_medi}`;

        // Move the uploaded file to retain the same name
        const destinationPath = path.join(__dirname, '../public', newFilePath);
        await fs.promises.rename(req.file.path, destinationPath);

        // Set the image URL for database storage
        imgUrl = newFilePath;

        await pool.query(
            `INSERT INTO medicines (medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_img) 
             VALUES (?, ?, ?, ?, ?)`,
            [medicine_name, medicine_composition, medicine_price, medicine_expiry_date, imgUrl]
        );
        // Render success page
        res.render("success", {
            pdfName: null,
            username: req.session.user?.username,
            profile: "admin",
            pagetitle: "Success",
            message: 'Medicine added successfully!'
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

// Edit or Delete Medicine
exports.deleteOrEditMedicine = [isAdmin, uploadMedicine.single('medicine_img'), async (req, res) => {
    try {
        const { action, medicine_id, medicine_name, medicine_composition, medicine_price, medicine_expiry_date } = req.body;
        // First get the current image path to delete the file
        const [currentMedicine] = await pool.query('SELECT medicine_img FROM medicines WHERE medicine_id = ?', [medicine_id]);

        if (action === "delete") {
            

            if (currentMedicine.length > 0 && currentMedicine[0].medicine_img) {
                const imagePath = path.join(__dirname, '../public', currentMedicine[0].medicine_img);
                // Delete the image file if it exists
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            }

            await pool.query('DELETE FROM medicines WHERE medicine_id = ?', [medicine_id]);
            res.render("success", {
                pdfName: null,
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Success",
                message: 'Medicine deleted successfully!'
            });
        } else if (action === "edit") {
            if (req.file) {
                const ext_medi = path.extname(req.file.originalname);
                const newFileName_medi = `${medicine_name}${ext_medi}`;
                newFilePath_medi = `/img/medicinesImg/${newFileName_medi}`;

                // Move the uploaded file
                const destinationPath = path.join(__dirname, '../public', newFilePath_medi);
                await fs.promises.rename(req.file.path, destinationPath);

                if (currentMedicine.length > 0 && currentMedicine[0].medicine_img) {
                    const oldImagePath = path.join(__dirname, '../public', currentMedicine[0].medicine_img);
                    
                    if (fs.existsSync(oldImagePath)) {
                        await fs.promises.unlink(oldImagePath);
                    }
                }

                // Update database with new image
                await pool.query(
                    `UPDATE medicines 
                     SET medicine_name = ?, medicine_composition = ?, medicine_price = ?, medicine_expiry_date = ?, medicine_img = ? 
                     WHERE medicine_id = ?`,
                    [medicine_name, medicine_composition, medicine_price, medicine_expiry_date, newFilePath_medi, medicine_id]
                );
            } else {
                // Update without changing image
                await pool.query(
                    `UPDATE medicines 
                     SET medicine_name = ?, medicine_composition = ?, medicine_price = ?, medicine_expiry_date = ? 
                     WHERE medicine_id = ?`,
                    [medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_id]
                );
            }
            return res.render("success", {
                pdfName: null,
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Success",
                message: 'Medicine Edited Successfully!'
            });
        }
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
        // if (!existingCustomer.length) {
        //     return res.status(404).render("404", {
        //         username: req.session.user?.username,
        //         profile: "admin",
        //         pagetitle: "Page Not Found",
        //         error: "Customer not found"
        //     });
        // }

        if (action === "delete") {
            // Delete customer photo if it's not the default
            const oldPhoto = existingCustomer[0].customer_photo;
            if (oldPhoto && !oldPhoto.includes('default_photo.jpg')) {
                const photoPath = path.join(__dirname, '..', 'private', 'uploads', 'customersPhotos', path.basename(oldPhoto));
                if (fs.existsSync(photoPath)) {
                    fs.unlinkSync(photoPath);
                }
            }

            await pool.query('DELETE FROM customers WHERE customer_id = ?', [customer_id]);

            res.render("success", {
                pdfName: null,
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Success",
                message: "Customer deleted successfully!"
            });

        } else if (action === "edit") {
            if (req.file) {
                // Create filename with customer_id for organization
                const ext_cust = path.extname(req.file.originalname);
                const newFileName_cust = `${customer_id}_photo${ext_cust}`;
                const newFilePath_cust = path.join('uploads/customersPhotos', newFileName_cust);

                // Move and rename the uploaded file
                fs.renameSync(
                    req.file.path,
                    path.join(__dirname, '../private', 'uploads/customersPhotos', newFileName_cust)
                );

                // Delete old photo if it exists and is not the default
                const oldPhoto = existingCustomer[0].customer_photo;
                if (oldPhoto && !oldPhoto.includes('default_photo.jpg')) {
                    const oldPath = path.join(__dirname, '..', 'private', 'uploads', 'customersPhotos', path.basename(oldPhoto));
                    if (fs.existsSync(oldPath)) {
                        fs.unlinkSync(oldPath);
                    }
                }

                await pool.query(
                    `UPDATE customers SET customer_name = ?, customer_email = ?, customer_ph_no = ?, 
                    customer_address = ?, customer_feedback = ?, customer_balance_amt = ?, 
                    customer_photo = ? WHERE customer_id = ?`,
                    [customer_name, customer_email, customer_ph_no, customer_address,
                        customer_feedback, customer_balance_amt, newFilePath_cust, customer_id]
                );

            } else {
                await pool.query(
                    `UPDATE customers SET customer_name = ?, customer_email = ?, customer_ph_no = ?, 
                    customer_address = ?, customer_feedback = ?, customer_balance_amt = ? 
                    WHERE customer_id = ?`,
                    [customer_name, customer_email, customer_ph_no, customer_address,
                        customer_feedback, customer_balance_amt, customer_id]
                );
            }

            res.render("success", {
                pdfName: null,
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Success",
                message: "Customer updated successfully!"
            });
        }
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
