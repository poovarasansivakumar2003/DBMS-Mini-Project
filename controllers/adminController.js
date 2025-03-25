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
                   SUM(s.stock_quantity) AS total_stock
            FROM medicines m
            LEFT JOIN stocks s ON m.medicine_id = s.medicine_id
            WHERE m.medicine_expiry_date > CURDATE()
            GROUP BY m.medicine_id
            HAVING total_stock > 0
        `);

        const [customersQuery] = await pool.query(`
            SELECT 
                c.customer_id, c.customer_created_at, c.customer_name, c.customer_email, 
                c.customer_ph_no, c.customer_balance_amt, c.customer_photo, 
                ca.address_id, ca.address_type, ca.street, ca.city, ca.state, ca.zip_code, 
                f.feedback_id, f.rating, f.feedback_text, f.feedback_date
            FROM customers c
            LEFT JOIN customer_addresses ca ON c.customer_id = ca.customer_id
            LEFT JOIN feedbacks f ON c.customer_id = f.customer_id
            ORDER BY c.customer_id, ca.address_id, f.feedback_id;
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

            if (row.address_id) {
                customers[row.customer_id].addresses.push({
                    address_id: row.address_id,
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

        const [suppliers] = await pool.execute(`SELECT * FROM suppliers;`);
        const [stocks] = await pool.execute(`
            SELECT m.medicine_name, s.supplier_name, st.stock_quantity 
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
    console.log("Received Data:", req.body); // Debugging line
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

        const { action, customer_id, customer_name, customer_email, customer_ph_no, customer_balance_amt, address_id, street, city, state, zip_code, address_type, feedback_id, rating, feedback_text } = req.body;
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
            if (!customer_name || !customer_email || !customer_ph_no || !customer_balance_amt || !street || !city || !state || !zip_code || !rating || !feedback_text) {
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

            // Update address
            await pool.execute(
                `UPDATE customer_addresses SET street=?, city=?, state=?, zip_code=?, address_type=? 
                 WHERE customer_id=? AND address_id=?`,
                [street, city, state, zip_code, address_type, customer_id, address_id]
            );

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
                message: "Customer updated successfully!"
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

// // Add Medicine
// exports.addMedicine = [isAdmin, async (req, res) => {
//     try {
//         const { medicine_name, medicine_composition, medicine_price, medicine_expiry_date } = req.body;
//         if (!medicine_name || !medicine_composition || !medicine_price || !medicine_expiry_date || !req.file) {
//             return res.status(400).render("400", {
//                 username: req.session.user?.username,
//                 profile: "admin",
//                 pagetitle: "Bad Request",
//                 error: "All fields are required"
//             });
//         }

//         const ext_medi = path.extname(req.file.originalname);
//         const newFileName_medi = `${medicine_name}${ext_medi}`;
//         newFilePath = `/img/medicinesImg/${newFileName_medi}`;

//         // Move the uploaded file to retain the same name
//         const destinationPath = path.join(__dirname, '../public', newFilePath);
//         await fs.promises.rename(req.file.path, destinationPath);

//         // Set the image URL for database storage
//         imgUrl = newFilePath;

//         await pool.query(
//             `INSERT INTO medicines (medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_img)
//              VALUES (?, ?, ?, ?, ?)`,
//             [medicine_name, medicine_composition, medicine_price, medicine_expiry_date, imgUrl]
//         );
//         // Render success page
//         res.render("success", {
//             pdfName: null,
//             username: req.session.user?.username,
//             profile: "admin",
//             pagetitle: "Success",
//             message: 'Medicine added successfully!'
//         });
//     } catch (err) {
//         console.error("Database Error:", err);
//         res.status(500).render("500", {
//             username: req.session.user?.username,
//             profile: "admin",
//             pagetitle: "Internal Server Error",
//             error: err.message
//         });
//     }
// }];

// // Edit or Delete Medicine
// exports.deleteOrEditMedicine = [isAdmin, uploadMedicine.single('medicine_img'), async (req, res) => {
//     try {
//         const { action, medicine_id, medicine_name, medicine_composition, medicine_price, medicine_expiry_date } = req.body;
//         // First get the current image path to delete the file
//         const [currentMedicine] = await pool.query('SELECT medicine_img FROM medicines WHERE medicine_id = ?', [medicine_id]);

//         if (action === "delete") {


//             if (currentMedicine.length > 0 && currentMedicine[0].medicine_img) {
//                 const imagePath = path.join(__dirname, '../public', currentMedicine[0].medicine_img);
//                 // Delete the image file if it exists
//                 if (fs.existsSync(imagePath)) {
//                     fs.unlinkSync(imagePath);
//                 }
//             }

//             await pool.query('DELETE FROM medicines WHERE medicine_id = ?', [medicine_id]);
//             res.render("success", {
//                 pdfName: null,
//                 username: req.session.user?.username,
//                 profile: "admin",
//                 pagetitle: "Success",
//                 message: 'Medicine deleted successfully!'
//             });
//         } else if (action === "edit") {
//             if (req.file) {
//                 const ext_medi = path.extname(req.file.originalname);
//                 const newFileName_medi = `${medicine_name}${ext_medi}`;
//                 newFilePath_medi = `/img/medicinesImg/${newFileName_medi}`;

//                 // Move the uploaded file
//                 const destinationPath = path.join(__dirname, '../public', newFilePath_medi);
//                 await fs.promises.rename(req.file.path, destinationPath);

//                 if (currentMedicine.length > 0 && currentMedicine[0].medicine_img) {
//                     const oldImagePath = path.join(__dirname, '../public', currentMedicine[0].medicine_img);

//                     if (fs.existsSync(oldImagePath)) {
//                         await fs.promises.unlink(oldImagePath);
//                     }
//                 }

//                 // Update database with new image
//                 await pool.query(
//                     `UPDATE medicines
//                      SET medicine_name = ?, medicine_composition = ?, medicine_price = ?, medicine_expiry_date = ?, medicine_img = ?
//                      WHERE medicine_id = ?`,
//                     [medicine_name, medicine_composition, medicine_price, medicine_expiry_date, newFilePath_medi, medicine_id]
//                 );
//             } else {
//                 // Update without changing image
//                 await pool.query(
//                     `UPDATE medicines
//                      SET medicine_name = ?, medicine_composition = ?, medicine_price = ?, medicine_expiry_date = ?
//                      WHERE medicine_id = ?`,
//                     [medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_id]
//                 );
//             }
//             return res.render("success", {
//                 pdfName: null,
//                 username: req.session.user?.username,
//                 profile: "admin",
//                 pagetitle: "Success",
//                 message: 'Medicine Edited Successfully!'
//             });
//         }
//     } catch (err) {
//         console.error("Database Error:", err);
//         res.status(500).render("500", {
//             username: req.session.user?.username,
//             profile: "admin",
//             pagetitle: "Internal Server Error",
//             error: err.message
//         });
//     }
// }];

// exports.processOrder = [isAdmin, async (req, res) => {
//     try {
//         const { purchaseId, supplierId, discount, paid } = req.body;

//         // Get purchase details
//         const [purchaseResult] = await pool.query(
//             'SELECT total_amt, customer_id, medicine_id, purchased_quantity FROM purchases WHERE purchase_id = ?',
//             [purchaseId]
//         );

//         if (!purchaseResult.length) {
//             throw new Error("Invalid purchase ID");
//         }

//         const { total_amt, customer_id, medicine_id, purchased_quantity } = purchaseResult[0];

//         // Calculate net total and balance
//         const net_total = total_amt - discount;
//         const balance = net_total - paid;

//         // Insert into invoice table
//         await pool.query(
//             'INSERT INTO invoice (purchase_id, discount, paid, total_amt_to_pay, net_total, balance) VALUES (?, ?, ?, ?, ?, ?)',
//             [purchaseId, discount, paid, total_amt, net_total, balance]
//         );

//         // Update customer's balance amount
//         await pool.query(
//             'UPDATE customers SET customer_balance_amt = customer_balance_amt + ? WHERE customer_id = ?',
//             [balance, customer_id]
//         );

//         // Reduce stock for the supplier
//         await pool.query(
//             'UPDATE stocks SET stock_quantity = stock_quantity - ? WHERE supplier_id = ? AND medicine_id = ?',
//             [purchased_quantity, supplierId, medicine_id]
//         );

//         res.render("success", {
//             username: req.session.user?.username,
//             profile: "admin",
//             pagetitle: "Success",
//             message: "Order approved successfully"
//         });

//     } catch (err) {
//         console.error("Database Error:", err);
//         res.status(500).render("500", {
//             username: req.session.user?.username,
//             profile: "admin",
//             pagetitle: "Internal Server Error",
//             error: err.message
//         });
//     }
// }];