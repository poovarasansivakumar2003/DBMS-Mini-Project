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
                    addresses: [],
                    feedbacks: []
                };
            }

            if (row.customer_address_id) {
                customers[row.customer_id].addresses.push({
                    customer_address_id: row.customer_address_id,
                    street: row.street,
                    city: row.city,
                    state: row.state,
                    zip_code: row.zip_code,
                    address_type: row.address_type
                });
            }

            if (row.feedback_id) {
                customers[row.customer_id].feedbacks.push({
                    feedback_id: row.feedback_id,
                    rating: row.rating,
                    feedback_text: row.feedback_text,
                    feedback_date: row.feedback_date
                });
            }
        });

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

        const [suppliersQuery] = await pool.execute(`SELECT s.*, sa.supplier_address_id, sa.street, sa.city, sa.state, sa.zip_code
        FROM suppliers s
        LEFT JOIN supplier_addresses sa ON s.supplier_id = sa.supplier_id`);

        const suppliers = [];
        const supplierMap = new Map();

        suppliersQuery.forEach(row => {
            if (!supplierMap.has(row.supplier_id)) {
                supplierMap.set(row.supplier_id, {
                    supplier_id: row.supplier_id,
                    supplier_name: row.supplier_name,
                    supplier_email: row.supplier_email,
                    supplier_ph_no: row.supplier_ph_no,
                    supplier_address: row.supplier_address,
                    addresses: []
                });
                suppliers.push(supplierMap.get(row.supplier_id));
            }
            if (row.customer_address_id) {
                supplierMap.get(row.supplier_id).addresses.push({
                    customer_address_id: row.customer_address_id,
                    street: row.street,
                    city: row.city,
                    state: row.state,
                    zip_code: row.zip_code
                });
            }
        });

        const [stocks] = await pool.execute(`
            SELECT m.medicine_name, m.medicine_composition ,s.supplier_name, st.stock_quantity 
            FROM stocks st 
            JOIN medicines m ON st.medicine_id = m.medicine_id 
            JOIN suppliers s ON st.supplier_id = s.supplier_id;
        `);

        // Render EJS page with data
        res.render('adminDashboard', {
            pagetitle: `Admin Panel - ${req.session.user.username}`,
            username: req.session.user.username,
            profile: "admin",
            customers: Object.values(customers),
            medicines,
            totalIncome,
            adminIncome,
            suppliers,
            stocks
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
        } else if (action === "editAddress"){
            if (!street || !city || !state || !zip_code ) {
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
        } else if (action === "editFeedback"){
            if (!rating || !feedback_text ) {
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

// Add Medicine
exports.addSupplier = [isAdmin, async (req, res) => {
    try {
        const {supplier_name, supplier_email, supplier_ph_no, street, city, state, zip_code } = req.body;
        if (!supplier_name || !supplier_email || !supplier_ph_no || !street || !city|| !state || !zip_code) {
            return res.status(400).render("400", {
                username: req.session.user?.username,
                profile: "admin",
                pagetitle: "Bad Request",
                error: "All fields are required"
            });
        }

        await connection.beginTransaction(); // Start Transaction

        // Insert into suppliers table
        const [supplierInsertResult] = await connection.query(
            `INSERT INTO suppliers (supplier_name, supplier_email, supplier_ph_no) VALUES (?, ?, ?)`,
            [supplier_name, supplier_email, supplier_ph_no]
        );

        if (supplierInsertResult.affectedRows === 0) {
            throw new Error("Failed to insert supplier.");
        }

        const supplier_id = supplierInsertResult.insertId;

        const [addressInsertResult] = await connection.query(
            `INSERT INTO supplier_addresses (supplier_id, street, city, state, zip_code) VALUES (?, ?, ?, ?, ?)`,
            [supplier_id, street, city, state, zip_code]
        );

        if (addressInsertResult.affectedRows === 0) {
            throw new Error("Failed to insert supplier address.");
        }

        await connection.commit(); 
        connection.release();

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
