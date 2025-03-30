const pool = require('../db');
const multer = require('multer');

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Only image files are allowed!"), false);
        }
        cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }
    next();
};

// ✅ Admin Dashboard Route
exports.getAdminDashboard = [isAdmin, async (req, res) => {
    try {
        const admin_username = req.session.user?.username;
        if (!admin_username) {
            return res.status(400).render("400", {
                username: null,
                profile: "admin",
                pagetitle: "Unauthorized",
                error: "User not logged in."
            });
        }

        const [medicinesForPurchase] = await pool.query(`SELECT m.medicine_id, m.medicine_name, m.medicine_composition, 
                     m.medicine_price, m.medicine_type, m.medicine_expiry_date, m.medicine_img, SUM(s.stock_quantity) as total_stock
              FROM medicines m
              LEFT JOIN stocks s ON m.medicine_id = s.medicine_id
              WHERE m.medicine_expiry_date > CURDATE()
              GROUP BY m.medicine_id
              HAVING total_stock > 0`
        );

        const [medicines] = await pool.query(`
            SELECT m.medicine_id, m.medicine_name, m.medicine_composition, m.medicine_price, 
                   m.medicine_type, m.medicine_expiry_date, m.medicine_img, 
                   IFNULL(SUM(s.stock_quantity), 0) AS total_stock
            FROM medicines m
            LEFT JOIN stocks s ON m.medicine_id = s.medicine_id
            GROUP BY m.medicine_id
        `);

        medicines.forEach(medicine => {
            if (medicine.medicine_img) {
                medicine.medicine_img = `data:image/jpeg;base64,${medicine.medicine_img.toString('base64')}`;
            } else {
                // Use default image if no image exists
                medicine.medicine_img = '/img/noImg.jpg';
            }
        });

        const [customersQuery] = await pool.query(`
            SELECT 
                c.customer_id, c.customer_created_at, c.customer_name, c.customer_email, 
                c.customer_ph_no, c.customer_balance_amt, c.customer_photo, 
                ca.customer_address_id, ca.address_type, ca.street, ca.city, ca.state, ca.zip_code, 
                f.feedback_id, f.rating, f.feedback_text, f.feedback_date
            FROM customers c
            LEFT JOIN customer_addresses ca ON c.customer_id = ca.customer_id
            LEFT JOIN feedbacks f ON c.customer_id = f.customer_id
            ORDER BY c.customer_id, ca.customer_address_id, f.feedback_id;
        `);

        let customers = {};
        customersQuery.forEach(row => {
            if (!customers[row.customer_id]) {
                customers[row.customer_id] = {
                    customer_id: row.customer_id,
                    customer_created_at: row.customer_created_at,
                    customer_name: row.customer_name,
                    customer_email: row.customer_email,
                    customer_ph_no: row.customer_ph_no,
                    customer_balance_amt: row.customer_balance_amt,
                    customer_photo: row.customer_photo
                        ? `data:image/jpeg;base64,${row.customer_photo.toString('base64')}`
                        : '/img/defaultPhoto.jpg',
                    addresses: new Map(),  // Store addresses in a Map to prevent duplicates
                    feedbacks: new Map()   // Store feedbacks in a Map to prevent duplicates
                };
            }

            // Add address if not already present
            if (row.customer_address_id && !customers[row.customer_id].addresses.has(row.customer_address_id)) {
                customers[row.customer_id].addresses.set(row.customer_address_id, {
                    customer_address_id: row.customer_address_id,
                    street: row.street,
                    city: row.city,
                    state: row.state,
                    zip_code: row.zip_code,
                    address_type: row.address_type
                });
            }

            // Add feedback if not already present
            if (row.feedback_id && !customers[row.customer_id].feedbacks.has(row.feedback_id)) {
                customers[row.customer_id].feedbacks.set(row.feedback_id, {
                    feedback_id: row.feedback_id,
                    rating: row.rating,
                    feedback_text: row.feedback_text,
                    feedback_date: row.feedback_date
                });
            }
        });

        const customersArray = Object.values(customers).map(customer => ({
            ...customer,
            addresses: Array.from(customer.addresses.values()),  // Convert Map to array
            feedbacks: Array.from(customer.feedbacks.values())   // Convert Map to array
        }));

        const [totalIncomeResult] = await pool.execute(
            `SELECT SUM(payment_amt) AS total_income FROM payments`
        );
        const [adminIncomeResult] = await pool.execute(
            "SELECT SUM(net_total) AS income_generated_by_admin FROM invoice WHERE admin_username = ?",
            [admin_username]
        );

        // Extract values correctly
        const totalIncome = totalIncomeResult[0]?.total_income || 0;
        const adminIncome = adminIncomeResult[0]?.income_generated_by_admin || 0;

        const [suppliersQuery] = await pool.execute(`
            SELECT 
                s.supplier_id, s.supplier_name, s.supplier_email, s.supplier_ph_no,
                sa.supplier_address_id, sa.street, sa.city, sa.state, sa.zip_code,
                m.medicine_id, m.medicine_name,
                st.stock_quantity
            FROM suppliers s
            LEFT JOIN supplier_addresses sa ON s.supplier_id = sa.supplier_id
            LEFT JOIN stocks st ON s.supplier_id = st.supplier_id
            LEFT JOIN medicines m ON st.medicine_id = m.medicine_id
            ORDER BY s.supplier_id ASC;
        `);

        let suppliers = {};

        suppliersQuery.forEach(row => {
            if (!suppliers[row.supplier_id]) {
                suppliers[row.supplier_id] = {
                    supplier_id: row.supplier_id,
                    supplier_name: row.supplier_name,
                    supplier_email: row.supplier_email,
                    supplier_ph_no: row.supplier_ph_no,
                    addresses: new Map(),  // Prevent duplicate addresses
                    medicines: new Map()   // Prevent duplicate medicines
                };
            }

            // Add address if not already present
            if (row.supplier_address_id && !suppliers[row.supplier_id].addresses.has(row.supplier_address_id)) {
                suppliers[row.supplier_id].addresses.set(row.supplier_address_id, {
                    supplier_address_id: row.supplier_address_id,
                    street: row.street,
                    city: row.city,
                    state: row.state,
                    zip_code: row.zip_code
                });
            }

            // Add medicine if not already present
            if (row.medicine_id && !suppliers[row.supplier_id].medicines.has(row.medicine_id)) {
                suppliers[row.supplier_id].medicines.set(row.medicine_id, {
                    medicine_id: row.medicine_id,
                    medicine_name: row.medicine_name,
                    stock_quantity: row.stock_quantity || 0 // Default to 0 if null
                });
            }
        });

        // Convert Maps to arrays for JSON response
        const suppliersArray = Object.values(suppliers).map(supplier => ({
            ...supplier,
            addresses: Array.from(supplier.addresses.values()),  // Convert Map to array
            medicines: Array.from(supplier.medicines.values())   // Convert Map to array
        }));

        const [cartItems] = await pool.query(`SELECT p.purchase_id,
            p.customer_id,
                        m.medicine_id,
                        m.medicine_name,
                        m.medicine_composition,
                        m.medicine_price,
                        p.purchased_quantity,
                        p.total_amt,
                        m.medicine_img
                    FROM purchases p
                    JOIN medicines m ON m.medicine_id = p.medicine_id
                    WHERE p.supplier_id IS NULL
        `);

        // Render EJS page with data
        res.render('adminDashboard', {
            pagetitle: `Admin Panel - ${req.session.user.username}`,
            username: req.session.user.username,
            profile: "admin",
            customers: Object.values(customersArray),
            medicines,
            totalIncome,
            adminIncome,
            suppliers: Object.values(suppliersArray),
            cartItems,
            medicinesForPurchase
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

// ✅ Edit or Delete Customer (Supports Image Update)
exports.deleteOrEditCustomer = [isAdmin, async (req, res) => {
    try {
        // Upload customer photo (if provided)
        await new Promise((resolve, reject) => {
            upload.single("customer_photo")(req, res, (err) => {
                if (err) {
                    return reject(res.status(500).render("500", {
                        username: req.session.user?.username,
                        profile: "admin",
                        pagetitle: "Internal Server Error",
                        error: "File upload error"
                    }));
                }
                resolve();
            });
        });

        const { action, customer_id, customer_name, customer_email, customer_ph_no, customer_balance_amt, customer_address_id, street, city, state, zip_code, address_type, feedback_id, rating, feedback_text } = req.body;
        let customer_photo = req.file ? req.file.buffer : null;

        if (!customer_id) {
            return res.status(400).render("400", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Bad Request",
                error: "Customer ID is required."
            });
        }

        if (action === "delete") {
            const [deleteResult] = await pool.query('DELETE FROM customers WHERE customer_id = ?', [customer_id]);
            if (deleteResult.affectedRows === 0) {
                return res.status(404).render("404", {
                    username: req.session.user?.username,
                    profile: "admin",
                    pagetitle: "Not Found",
                    error: "Customer not found or already deleted."
                });
            }
            return res.render("success", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Success",
                message: "Customer deleted successfully!"
            });
        } else if (action === "edit") {
            if (!customer_name || !customer_email || !customer_ph_no || !customer_balance_amt) {
                return res.status(400).render("400", {
                    username: req.session.user?.username,
                    profile: "admin",
                    pagetitle: "Bad Request",
                    error: "All fields must be provided for editing."
                });
            }

            // Update customer info
            await pool.query(
                `UPDATE customers SET customer_name=?, customer_email=?, customer_ph_no=?, 
                 customer_balance_amt=? ${customer_photo ? ', customer_photo=?' : ''} WHERE customer_id=?`,
                customer_photo ? [customer_name, customer_email, customer_ph_no, customer_balance_amt, customer_photo, customer_id]
                    : [customer_name, customer_email, customer_ph_no, customer_balance_amt, customer_id]
            );

            return res.render("success", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Success",
                message: "Customer details updated successfully!"
            });
        } else if (action === "addAddress") {
            await pool.execute(
                "INSERT INTO customer_addresses (customer_id, street, city, state, zip_code, address_type) VALUES (?, ?, ?, ?, ?, ?)",
                [customer_id, street, city, state, zip_code, address_type]
            );

            res.render("success", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Success",
                message: "Customer address has been added successfully!"
            });
        } else if (action === "deleteAddress") {
            const [deleteResult] = await pool.query('DELETE FROM customer_addresses WHERE customer_address_id=? AND customer_id = ?', [customer_address_id, customer_id]);
            if (deleteResult.affectedRows === 0) {
                return res.status(404).render("404", {
                    username: req.session.user?.username,
                    profile: "admin",
                    pagetitle: "Not Found",
                    error: "Address not found or already deleted."
                });
            }
            return res.render("success", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Success",
                message: "Address deleted successfully!"
            });
        } else if (action === "editAddress") {
            if (!street || !city || !state || !zip_code) {
                return res.status(400).render("400", {
                    username: req.session.user?.username,
                    profile: "admin",
                    pagetitle: "Bad Request",
                    error: "All fields must be provided for editing."
                });
            }

            // Update address
            await pool.execute(
                `UPDATE customer_addresses SET street=?, city=?, state=?, zip_code=?, address_type=? 
                 WHERE customer_id=? AND customer_address_id=?`,
                [street, city, state, zip_code, address_type, customer_id, customer_address_id]
            );

            return res.render("success", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Success",
                message: "Customer details updated successfully!"
            });
        } else if (action === "deleteFeedback") {
            const [deleteResult] = await pool.query('DELETE FROM feedbacks WHERE customer_id=? AND feedback_id=?', [customer_id, feedback_id]);
            if (deleteResult.affectedRows === 0) {
                return res.status(404).render("404", {
                    username: req.session.user?.username,
                    profile: "admin",
                    pagetitle: "Not Found",
                    error: "Feedback not found or already deleted."
                });
            }
            return res.render("success", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Success",
                message: "Feedback deleted successfully!"
            });
        } else if (action === "editFeedback") {
            if (!rating || !feedback_text) {
                return res.status(400).render("400", {
                    username: req.session.user?.username,
                    profile: "admin",
                    pagetitle: "Bad Request",
                    error: "All fields must be provided for editing."
                });
            }

            // Update feedback
            await pool.execute(
                `UPDATE feedbacks SET rating=?, feedback_text=?, feedback_date=CURRENT_TIMESTAMP 
                 WHERE customer_id=? AND feedback_id=?`,
                [rating, feedback_text, customer_id, feedback_id]
            );

            return res.render("success", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Success",
                message: "Customer details updated successfully!"
            });
        }

        return res.status(400).render("400", {
            username: req.session.user?.username,
            profile: "admin",
            pagetitle: "Bad Request",
            error: "Invalid action provided."
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
exports.addMedicine = [isAdmin, async (req, res) => {
    try {
        // Upload customer photo (if provided)
        await new Promise((resolve, reject) => {
            upload.single("medicine_img")(req, res, (err) => {
                if (err) {
                    return reject(res.status(500).render("500", {
                        username: req.session.user?.username,
                        profile: "admin",
                        pagetitle: "Internal Server Error",
                        error: "File upload error"
                    }));
                }
                resolve();
            });
        });

        const { medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_type } = req.body;
        let medicine_img = req.file ? req.file.buffer : null;

        if (!medicine_name || !medicine_composition || !medicine_price || !medicine_expiry_date || !medicine_type) {
            return res.status(400).render("400", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Bad Request",
                error: "All fields are required"
            });
        }

        const [insertResult] = await pool.query(
            `INSERT INTO medicines (medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_img, medicine_type)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_img, medicine_type]
        );

        if (insertResult.affectedRows === 0) {
            return res.status(500).render("500", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Internal Server Error",
                error: "Unable to insert into database."
            });
        }

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
exports.deleteOrEditMedicine = [isAdmin, async (req, res) => {
    try {
        await new Promise((resolve, reject) => {
            upload.single("medicine_img")(req, res, (err) => {
                if (err) {
                    return reject(res.status(500).render("500", {
                        username: req.session.user?.username,
                        profile: "admin",
                        pagetitle: "Internal Server Error",
                        error: "File upload error"
                    }));
                }
                resolve();
            });
        });

        let medicine_img = req.file ? req.file.buffer : null;

        const { action, medicine_id, medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_type } = req.body;
        if (!medicine_id) {
            return res.status(400).render("400", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Bad Request",
                error: "Medicine ID is required."
            });
        }

        if (action === "delete") {
            const [deleteResult] = await pool.query('DELETE FROM medicines WHERE medicine_id = ?', [medicine_id]);
            if (deleteResult.affectedRows === 0) {
                return res.status(404).render("404", {
                    username: req.session.user?.username,
                    profile: "admin",
                    pagetitle: "Not Found",
                    error: "Medicine not found or already deleted."
                });
            }

            res.render("success", {
                pdfName: null,
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Success",
                message: 'Medicine deleted successfully!'
            });

        } else if (action === "edit") {

            if (!medicine_name || !medicine_composition || !medicine_price || !medicine_expiry_date || !medicine_type) {
                return res.status(400).render("400", {
                    username: req.session.user?.username,
                    profile: "admin",
                    pagetitle: "Bad Request",
                    error: "All fields must be provided for editing."
                });
            }

            await pool.query(
                `UPDATE medicines
                 SET medicine_name = ?, medicine_composition = ?, medicine_price = ?, medicine_expiry_date = ?, medicine_type = ?, medicine_img = ?
                 WHERE medicine_id = ?`,
                [medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_type, medicine_img, medicine_id]
            );

            return res.render("success", {
                pdfName: null,
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Success",
                message: 'Medicine Edited Successfully!'
            });
        }
        return res.status(400).render("400", {
            username: req.session.user?.username,
            profile: "customer",
            pagetitle: "Bad Request",
            error: "Invalid action provided."
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

// Add Supplier
exports.addSupplier = [isAdmin, async (req, res) => {
    try {
        const { supplier_name, supplier_email, supplier_ph_no, street, city, state, zip_code } = req.body;
        if (!supplier_name || !supplier_email || !supplier_ph_no || !street || !city || !state || !zip_code) {
            return res.status(400).render("400", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Bad Request",
                error: "All fields are required"
            });
        }

        // Insert into suppliers table
        const [supplierInsertResult] = await pool.query(
            `INSERT INTO suppliers (supplier_name, supplier_email, supplier_ph_no) VALUES (?, ?, ?)`,
            [supplier_name, supplier_email, supplier_ph_no]
        );

        const supplier_id = supplierInsertResult.insertId;

        const [addressInsertResult] = await pool.query(
            `INSERT INTO supplier_addresses (supplier_id, street, city, state, zip_code) VALUES (?, ?, ?, ?, ?)`,
            [supplier_id, street, city, state, zip_code]
        );

        if (supplierInsertResult.affectedRows === 0 && addressInsertResult.affectedRows === 0) {
            return res.status(500).render("500", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Internal Server Error",
                error: "Failed to insert supplier."
            });
        }

        // Render success page
        res.render("success", {
            pdfName: null,
            username: req.session.user?.username,
            profile: "admin",
            pagetitle: "Success",
            message: 'Supplier added successfully!'
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

exports.deleteOrEditSupplier = [isAdmin, async (req, res) => {
    try {
        const { action, supplier_id, supplier_name, supplier_email, supplier_ph_no, supplier_address_id, street, city, state, zip_code, stock_quantity } = req.body;

        if (!supplier_id) {
            return res.status(400).render("400", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Bad Request",
                error: "Supplier ID is required."
            });
        }

        if (action === "delete") {
            const [deleteResult] = await pool.query('DELETE FROM suppliers WHERE supplier_id = ?', [supplier_id]);
            if (deleteResult.affectedRows === 0) {
                return res.status(404).render("404", {
                    username: req.session.user?.username,
                    profile: "admin",
                    pagetitle: "Not Found",
                    error: "Supplier not found or already deleted."
                });
            }
            return res.render("success", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Success",
                message: "Supplier deleted successfully!"
            });
        } else if (action === "edit") {
            if (!supplier_name || !supplier_email || !supplier_ph_no) {
                return res.status(400).render("400", {
                    username: req.session.user?.username,
                    profile: "admin",
                    pagetitle: "Bad Request",
                    error: "All fields must be provided for editing."
                });
            }

            // Update customer info
            await pool.query(
                `UPDATE suppliers SET supplier_name = ?, supplier_email = ?, supplier_ph_no = ? WHERE supplier_id=?`,
                [supplier_name, supplier_email, supplier_ph_no, supplier_id]
            );

            return res.render("success", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Success",
                message: "Supplier details updated successfully!"
            });
        } else if (action === "addAddress") {
            await pool.execute(
                "INSERT INTO supplier_addresses (supplier_id, street, city, state, zip_code) VALUES (?, ?, ?, ?, ?)",
                [supplier_id, street, city, state, zip_code]
            );

            res.render("success", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Success",
                message: "Supplier address has been added successfully!"
            });
        } else if (action === "deleteAddress") {
            const [deleteResult] = await pool.query('DELETE FROM supplier_addresses WHERE supplier_address_id=? AND supplier_id = ?', [supplier_address_id, supplier_id]);
            if (deleteResult.affectedRows === 0) {
                return res.status(404).render("404", {
                    username: req.session.user?.username,
                    profile: "admin",
                    pagetitle: "Not Found",
                    error: "Address not found or already deleted."
                });
            }
            return res.render("success", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Success",
                message: "Address deleted successfully!"
            });
        } else if (action === "editAddress") {
            if (!street || !city || !state || !zip_code) {
                return res.status(400).render("400", {
                    username: req.session.user?.username,
                    profile: "admin",
                    pagetitle: "Bad Request",
                    error: "All fields must be provided for editing."
                });
            }

            // Update address
            await pool.execute(
                `UPDATE supplier_addresses SET street=?, city=?, state=?, zip_code=? 
                 WHERE supplier_id=? AND supplier_address_id=?`,
                [street, city, state, zip_code, supplier_id, supplier_address_id]
            );

            return res.render("success", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Success",
                message: "Supplier details updated successfully!"
            });
        }
        return res.status(400).render("400", {
            username: req.session.user?.username,
            profile: "admin",
            pagetitle: "Bad Request",
            error: "Invalid action provided."
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

exports.addStocks = [isAdmin, async (req, res) => {
    try {
        const { supplier_id, medicine_id, stock_quantity } = req.body;

        if (!supplier_id || !stock_quantity || !medicine_id) {
            return res.status(400).render("400", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Bad Request",
                error: "All fields must be provided for editing."
            });
        }

        // Check if stock already exists
        const [existingStock] = await pool.execute(
            `SELECT stock_quantity FROM stocks WHERE supplier_id = ? AND medicine_id = ?`,
            [supplier_id, medicine_id]
        );

        if (existingStock.length > 0) {
            // If stock exists, update it by adding new quantity
            const newQuantity = existingStock[0].stock_quantity + parseInt(stock_quantity, 10);

            await pool.execute(
                `UPDATE stocks SET stock_quantity = ? WHERE supplier_id = ? AND medicine_id = ?`,
                [newQuantity, supplier_id, medicine_id]
            );
        } else {
            // If stock does not exist, insert a new record
            await pool.execute(
                `INSERT INTO stocks (supplier_id, medicine_id, stock_quantity) VALUES (?, ?, ?)`,
                [supplier_id, medicine_id, stock_quantity]
            );
        }

        return res.render("success", {
            username: req.session.user?.username,
            profile: "admin",
            pagetitle: "Success",
            message: "Stocks added successfully!"
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

exports.deleteOrEditStocks = [isAdmin, async (req, res) => {
    try {
        const { action, supplier_id, medicine_id, stock_quantity } = req.body;

        if (!supplier_id || !medicine_id) {
            return res.status(400).render("400", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Bad Request",
                error: "Supplier ID and Medicine ID is required."
            });
        }

        if (action === "delete") {
            const [deleteResult] = await pool.query('DELETE FROM stocks WHERE supplier_id = ? AND medicine_id = ?', [supplier_id, medicine_id]);
            if (deleteResult.affectedRows === 0) {
                return res.status(404).render("404", {
                    username: req.session.user?.username,
                    profile: "admin",
                    pagetitle: "Not Found",
                    error: "Stock not found or already deleted."
                });
            }
            return res.render("success", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Success",
                message: "Stock deleted successfully!"
            });
        } else if (action === "edit") {
            if (!supplier_id || !stock_quantity || !medicine_id) {
                return res.status(400).render("400", {
                    username: req.session.user?.username,
                    profile: "admin",
                    pagetitle: "Bad Request",
                    error: "All fields must be provided for editing."
                });
            }

            // Update customer info
            await pool.query(
                `UPDATE stocks SET stock_quantity = ? WHERE supplier_id = ? AND medicine_id = ?`,
                [stock_quantity, supplier_id, medicine_id]
            );

            return res.render("success", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Success",
                message: "Stock details updated successfully!"
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

exports.purchaseMedicine = [isAdmin, async (req, res) => {
    try {
        const { customer_id, medicine_id, purchased_quantity } = req.body;

        if (!customer_id || !medicine_id || !purchased_quantity) {
            return res.status(400).render("400", {
                profile: "admin",
                username: req.session.user?.username,
                pagetitle: "Bad Request",
                error: "Missing required fields."
            });
        }

        // Insert into purchases table
        const query = `
            INSERT INTO purchases (customer_id, medicine_id, supplier_id, purchased_quantity)
            VALUES (?, ?, NULL , ?)`;

        await pool.query(query, [customer_id, medicine_id, purchased_quantity]);

        res.render("success", {
            pdfName: null,
            username: req.session.user?.username,
            profile: "admin",
            pagetitle: "Success",
            message: "Added to cart"
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

exports.processCart = [isAdmin, async (req, res) => {
    try {
        const { action, customer_id, purchase_id, supplier_id, medicine_id, purchased_quantity } = req.body;

        if (action === "delete") {
            // Delete the address
            const [deleteResult] = await pool.execute(
                "DELETE FROM purchases WHERE customer_id = ? AND purchase_id = ?",
                [customer_id, purchase_id]
            );

            if (deleteResult.affectedRows === 0) {
                return res.status(404).render("404", {
                    username: req.session.user?.username,
                    profile: "admin",
                    pagetitle: "Not Found",
                    error: "Cart not found or already deleted."
                });
            }

            return res.render("success", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Success",
                message: "Cart has been deleted successfully!"
            });
        }
        else if (action === "edit") {
            // Validate input fields
            if (!customer_id || !purchase_id || !supplier_id || !medicine_id || !purchased_quantity) {
                return res.status(400).render("400", {
                    username: req.session.user?.username,
                    profile: "customer",
                    pagetitle: "Bad Request",
                    error: "All details fields must be provided."
                });
            }

            // Update the address
            await pool.execute(
                "UPDATE purchases SET medicine_id = ?, purchased_quantity = ?, supplier_id =? WHERE customer_id = ? AND purchase_id=?",
                [medicine_id, purchased_quantity, supplier_id, customer_id, purchase_id]
            );

            return res.render("success", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Success",
                message: "Purchase details has been updated successfully!"
            });
        }

        return res.status(400).render("400", {
            username: req.session.user?.username,
            profile: "customer",
            pagetitle: "Bad Request",
            error: "Invalid action provided."
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
