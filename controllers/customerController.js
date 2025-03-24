const fs = require('fs');
const pool = require('../db');
const bcrypt = require("bcryptjs");
const multer = require('multer');
const path = require('path');
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: function (req, file, cb) {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Only image files are allowed!"), false);
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
        if (!customerId) {
            return res.status(400).render("400", {
                username: req.session.user?.username,
                profile: "customer",
                pagetitle: "Unauthorized",
                error: "User not logged in."
            });
        }
        // Fetch customer details
        const [customerResult] = await pool.query('SELECT c.customer_id, c.customer_created_at, c.customer_name, c.customer_email, c.customer_ph_no, c.customer_photo, c.customer_balance_amt FROM customers c WHERE c.customer_id = ?', [customerId]);
        const [addressResult] = await pool.query('SELECT * FROM customer_addresses ca WHERE ca.customer_id = ?', [customerId]);
        const [feedbackResult] = await pool.query('SELECT * FROM feedbacks f WHERE f.customer_id = ?', [customerId]);


        if (!customerResult.length) {
            return res.status(404).render("404", {
                profile: req.session.user?.role,
                username: req.session.user?.username,
                pagetitle: "Page Not Found",
                error: "Customer not found"
            });
        }

        const customer = customerResult[0];

        // Check if customer has a photo, otherwise use default image
        if (customer && customer.customer_photo) {
            customer.customer_photo = `data:image/jpeg;base64,${customer.customer_photo.toString('base64')}`;
        } else {
            customer.customer_photo = '/img/defaultPhoto.jpg';
        }

        const addresses = Array.isArray(addressResult) ? addressResult : [];
        const feedbacks = Array.isArray(feedbackResult) ? feedbackResult : [];

        // Fetch available medicines
        const [medicines] = await pool.query('SELECT * FROM medicines');

        const [invoice] = await pool.query(`
            SELECT 
            i.invoice_no, 
            i.invoice_time, 
            a.admin_username, 
            GROUP_CONCAT(m.medicine_name ORDER BY m.medicine_name SEPARATOR ', ') AS medicine_names,
            GROUP_CONCAT(m.medicine_composition ORDER BY m.medicine_name SEPARATOR ', ') AS medicine_compositions,
            GROUP_CONCAT(COALESCE(s.supplier_name, 'Unknown') ORDER BY m.medicine_name SEPARATOR ', ') AS supplier_names,
            GROUP_CONCAT(DATE_FORMAT(m.medicine_expiry_date, '%Y-%m-%d') ORDER BY m.medicine_name SEPARATOR ', ') AS medicine_expiry_dates,
            GROUP_CONCAT(m.medicine_price ORDER BY m.medicine_name SEPARATOR ', ') AS medicine_prices,
            GROUP_CONCAT(p.purchased_quantity ORDER BY m.medicine_name SEPARATOR ', ') AS purchased_quantities,
            GROUP_CONCAT(p.total_amt ORDER BY m.medicine_name SEPARATOR ', ') AS total_amt,
            ps.actual_amt_to_pay,
            i.prev_balance, 
            i.total_amt_to_pay,
            i.discount,
            i.net_total,
            py.payment_amt AS amount_paid, 
            py.payment_time AS payment_date,
            i.curr_balance    
            FROM invoice i
            JOIN purchase_sessions ps ON i.purchase_session_id = ps.purchase_session_id 
            JOIN purchases p ON ps.customer_id = p.customer_id AND ps.purchase_time = p.purchase_time
            JOIN medicines m ON p.medicine_id = m.medicine_id
            LEFT JOIN suppliers s ON p.supplier_id = s.supplier_id
            JOIN customers c ON ps.customer_id = c.customer_id  
            LEFT JOIN admin a ON i.admin_username = a.admin_username  
            LEFT JOIN payments py ON i.payment_id = py.payment_id  
            WHERE ps.customer_id = ?
            GROUP BY i.invoice_no
            ORDER BY i.invoice_time DESC
        `, [customerId]);

        res.render('customerDashboard', {
            pagetitle: `Customer Panel - ${req.session.user.username}`,
            username: req.session.user.username,
            profile: "customer",
            customerId,
            medicines,
            customer,
            addresses,
            feedbacks,
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

exports.deleteOrEditAddress = [isCustomer, async (req, res) => {
    try {
        const { address_id, action, street, city, state, zip_code, address_type } = req.body;
        const customerId = req.session.customerId;

        if (!customerId) {
            return res.status(400).render("400", {
                username: req.session.user?.username,
                profile: "customer",
                pagetitle: "Unauthorized",
                error: "User not logged in."
            });
        }

        // Check if address exists and belongs to customer
        const [existingAddress] = await pool.execute(
            "SELECT * FROM customer_addresses WHERE customer_id = ? AND address_id = ?",
            [customerId, address_id]
        );

        if (!existingAddress.length) {
            return res.status(404).render("404", {
                username: req.session.user?.username,
                profile: "customer",
                pagetitle: "Not Found",
                error: "Address not found."
            });
        }

        if (action === "delete") {
            // Delete the address
            const [deleteResult] = await pool.execute(
                "DELETE FROM customer_addresses WHERE customer_id = ? AND address_id = ?",
                [customerId, address_id] // Fixed `addressId` to `address_id`
            );

            if (deleteResult.affectedRows === 0) {
                return res.status(404).render("404", {
                    username: req.session.user?.username,
                    profile: "customer",
                    pagetitle: "Not Found",
                    error: "Address not found or already deleted."
                });
            }

            return res.render("success", {
                username: req.session.user?.username,
                profile: "customer",
                pagetitle: "Success",
                message: "Your address has been deleted successfully!"
            });
        } 
        
        if (action === "edit") {
            // Validate input fields
            if (!street || !city || !state || !zip_code || !address_type) {
                return res.status(400).render("400", {
                    username: req.session.user?.username,
                    profile: "customer",
                    pagetitle: "Bad Request",
                    error: "All address fields must be provided."
                });
            }

            // Update the address
            await pool.execute(
                "UPDATE customer_addresses SET street=?, city=?, state=?, zip_code=?, address_type=? WHERE customer_id = ? AND address_id=?",
                [street, city, state, zip_code, address_type, customerId, address_id]
            );

            return res.render("success", {
                username: req.session.user?.username,
                profile: "customer",
                pagetitle: "Success",
                message: "Your address has been updated successfully!"
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
            profile: "customer",
            pagetitle: "Internal Server Error",
            error: err.message
        });
    }
}];

exports.deleteOrEditFeedback = [isCustomer, async (req, res) => {
    try {
        const { feedback_id, action, rating, feedback_text } = req.body;
        const customerId = req.session.customerId;

        if (!customerId) {
            return res.status(400).render("400", {
                username: req.session.user?.username,
                profile: "customer",
                pagetitle: "Unauthorized",
                error: "User not logged in."
            });
        }

        // Check if address exists and belongs to customer
        const [existingFeedback] = await pool.execute(
            "SELECT * FROM feedbacks WHERE customer_id = ? AND feedback_id = ?",
            [customerId, feedback_id]
        );

        if (!existingFeedback.length) {
            return res.status(404).render("404", {
                username: req.session.user?.username,
                profile: "customer",
                pagetitle: "Not Found",
                error: "Feedback not found."
            });
        }

        if (action === "delete") {
            // Delete the address
            const [deleteResult] = await pool.execute("DELETE FROM feedbacks WHERE customer_id = ? AND feedback_id = ?", [customerId, feedback_id]);
        
            if (deleteResult.affectedRows === 0) {
                return res.status(404).render("404", {
                    username: req.session.user?.username,
                    profile: "customer",
                    pagetitle: "Not Found",
                    error: "Feedback not found or already deleted."
                });
            }

            res.render("success", {
                username: req.session.user?.username,
                profile: "customer",
                pagetitle: "Success",
                message: "Your feedback has been deleted successfully!"
            });
        } 
        
        if (action === "edit") {
            // Validate input fields
            if (!rating || !feedback_text){
                return res.status(400).render("400", {
                    username: req.session.user?.username,
                    profile: "customer",
                    pagetitle: "Bad Request",
                    error: "All Feedback fields must be provided."
                });
            }

            await pool.execute(
                "UPDATE feedbacks SET rating=?, feedback_text=?, feedback_date=CURRENT_TIMESTAMP WHERE customer_id = ? AND feedback_id=?",
                [rating, feedback_text, customerId, feedback_id]
            );
            res.render("success", {
                username: req.session.user?.username,
                profile: "customer",
                pagetitle: "Success",
                message: "Your feedback has been updated successfully!"
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
            profile: "customer",
            pagetitle: "Internal Server Error",
            error: err.message
        });
    }
}];

// Add Address
exports.addAddress = [isCustomer, async (req, res) => {
    const { street, city, state, zip_code, address_type } = req.body;
    try {
        const customerId = req.session.customerId;
        if (!customerId) {
            return res.status(400).render("400", {
                username: req.session.user?.username,
                profile: "customer",
                pagetitle: "Unauthorized",
                error: "User not logged in."
            });
        }
        await pool.execute(
            "INSERT INTO customer_addresses (customer_id, street, city, state, zip_code, address_type) VALUES (?, ?, ?, ?, ?, ?)",
            [customerId, street, city, state, zip_code, address_type]
        );
        res.render("success", {
            username: req.session.user?.username,
            profile: "customer",
            pagetitle: "Success",
            message: "Your address has been added successfully!"
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

// Add Feedback
exports.addFeedback = [isCustomer, async (req, res) => {
    const { rating, feedback_text } = req.body;
    try {
        const customerId = req.session.customerId;
        
        if (!customerId) {
            return res.status(400).render("400", {
                username: req.session.user?.username,
                profile: "customer",
                pagetitle: "Unauthorized",
                error: "User not logged in."
            });
        }
        await pool.execute(
            "INSERT INTO feedbacks (customer_id, rating, feedback_text) VALUES (?, ?, ?)",
            [customerId, rating, feedback_text]
        );
        res.render("success", {
            username: req.session.user?.username,
            profile: "customer",
            pagetitle: "Success",
            message: "Your feedback has been added successfully!"
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
    try {
        // Upload customer photo
        await new Promise((resolve, reject) => {
            upload.single("customer_photo")(req, res, (err) => {
                if (err) {
                    console.error("Multer error:", err);
                    return reject(res.status(500).render("500", {
                        username: req.session.user?.username,
                        profile: "customer",
                        pagetitle: "Internal Server Error",
                        error: "File upload error"
                    }));
                }
                resolve();
            });
        });

        const customerId = req.session.customerId;

        if (!customerId) {
            return res.status(400).render("400", {
                username: req.session.user?.username,
                profile: "customer",
                pagetitle: "Unauthorized",
                error: "User not logged in."
            });
        }
        const { customer_name, customer_email, customer_ph_no, customer_password } = req.body;

        // Fetch customer details including password
        const [existingCustomer] = await pool.query(
            "SELECT customer_id, customer_password FROM customers WHERE customer_id = ?",
            [customerId]
        );

        // Check if customer exists
        if (existingCustomer.length === 0) {
            return res.status(404).render("404", {
                username: req.session.user?.username,
                profile: "customer",
                pagetitle: "Page Not Found",
                error: "Customer not found"
            });
        }

        const storedPassword = existingCustomer[0].customer_password;

        // Ensure passwords match
        const isMatch = await bcrypt.compare(customer_password.trim(), storedPassword);
        if (!isMatch) {
            return res.status(400).render("400", {
                username: req.session.user?.username,
                profile: "customer",
                pagetitle: "Bad Request",
                error: "Invalid credentials"
            });
        }

        // Check if email or phone number already exists for another customer
        const [duplicateCustomer] = await pool.query(
            "SELECT customer_id FROM customers WHERE (customer_email = ? OR customer_ph_no = ?) AND customer_id != ?",
            [customer_email, customer_ph_no, customerId]
        );

        if (duplicateCustomer.length > 0) {
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).render("400", {
                username: req.session.user?.username,
                profile: "customer",
                pagetitle: "Bad Request",
                error: "Another customer with this email or phone number already exists"
            });
        }

        let updateFields = [];
        let updateValues = [];

        if (customer_name) {
            updateFields.push("customer_name = ?");
            updateValues.push(customer_name);
        }
        if (customer_email) {
            updateFields.push("customer_email = ?");
            updateValues.push(customer_email);
        }
        if (customer_ph_no) {
            updateFields.push("customer_ph_no = ?");
            updateValues.push(customer_ph_no);
        }

        let customer_photo = null;
        if (req.file) {
            customer_photo = req.file.buffer;
            updateFields.push("customer_photo = ?");
            updateValues.push(customer_photo);
        }

        if (updateFields.length > 0) {
            updateValues.push(customerId);
            await pool.query(
                `UPDATE customers SET ${updateFields.join(", ")} WHERE customer_id = ?`,
                updateValues
            );
        }

        // Fetch updated customer details
        const [customerUpdate] = await pool.query(
            `SELECT customer_id, customer_created_at, customer_name, customer_email, customer_ph_no, customer_photo, customer_balance_amt 
            FROM customers WHERE customer_id = ?`,
            [customerId]
        );

        const customer = customerUpdate[0];

        // Fetch addresses
        const [addressResult] = await pool.query(
            "SELECT address_type, street, city, state, zip_code FROM customer_addresses WHERE customer_id = ?",
            [customerId]
        );

        // Ensure PDF directory exists
        const pdfDirectory = path.join(__dirname, "../private/customerCards");
        if (!fs.existsSync(pdfDirectory)) {
            fs.mkdirSync(pdfDirectory, { recursive: true });
        }

        const pdfFileName = `${customer.customer_id}_card.pdf`;
        const pdfPath = path.join(pdfDirectory, pdfFileName);

        const pdfStream = fs.createWriteStream(pdfPath);

        try {
            await generateCustomerPDF(customer, addressResult, pdfStream);
        } catch (pdfError) {
            console.error("PDF Generation Error:", pdfError);
            return res.status(500).render("500", {
                username: req.session.user?.username,
                profile: "customer",
                pagetitle: "Internal Server Error",
                error: "Failed to generate customer card"
            });
        }

        res.render("success", {
            pdfName: pdfFileName,
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


async function generateCustomerPDF(customerData, addresses, outputStream) {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: "A4", margin: 50 });
            doc.pipe(outputStream);

            // Load font (ensure "Helvetica" is available, or use a built-in default)
            doc.font("Helvetica");

            // Header
            doc.rect(0, 0, 595, 80).fill("#2563eb");
            doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(24).text("MediVerse", 50, 30);

            // Company Logo
            const iconPath = path.join(__dirname, "../public/img/favicon.png");
            if (fs.existsSync(iconPath)) {
                doc.image(iconPath, 500, 20, { width: 50 });
            }

            let yPosition = 100;

            // Ensure photo is displayed correctly
            if (customerData.customer_photo) {
                const customerPhoto = Buffer.isBuffer(customerData.customer_photo)
                    ? customerData.customer_photo
                    : Buffer.from(customerData.customer_photo);

                doc.roundedRect(50, yPosition, 100, 100, 10).stroke();
                doc.image(customerPhoto, 55, yPosition + 5, { fit: [90, 90] });
            }

            // Set font color back to black for text
            doc.fillColor("#000000");

            // Customer Information Section
            const infoStartX = 180;
            const labelWidth = 120;
            const valueStartX = infoStartX + labelWidth + 10;
            const fontSize = 12;
            let textYPosition = yPosition; // Aligning with image height

            doc.fontSize(fontSize).fillColor("#000000");

            const addDetailRow = (label, value) => {
                doc.font("Helvetica-Bold").text(label, infoStartX, textYPosition, { continued: false });
                doc.font("Helvetica").text(value, valueStartX, textYPosition);
                textYPosition += 25;
            };

            addDetailRow("Customer ID:", customerData.customer_id || "N/A");
            addDetailRow("Registered On:", customerData.customer_created_at || "N/A");
            textYPosition += 20;
            addDetailRow("Name:", customerData.customer_name || "N/A");
            addDetailRow("Email:", customerData.customer_email || "N/A");
            addDetailRow("Phone Number:", customerData.customer_ph_no || "N/A");

            // Addresses (Limit to 5 entries)
            if (Array.isArray(addresses)) {
                addresses.slice(0, 5).forEach((addr) => {
                    addDetailRow("Address Type:", addr.address_type || "N/A");
                    addDetailRow("Street:", addr.street || "N/A");
                    addDetailRow("City:", addr.city || "N/A");
                    addDetailRow("State:", addr.state || "N/A");
                    addDetailRow("Zip Code:", addr.zip_code || "N/A");
                });
            }

            // QR Code Section
            textYPosition += 30;
            doc.fontSize(14).fillColor("#2563eb").text("Scan QR for Details", 400, textYPosition);
            textYPosition += 20;

            // Generate QR Code & Add to PDF
            const qrData = `Customer ID: ${customerData.customer_id}\nName: ${customerData.customer_name}\nPhone: ${customerData.customer_ph_no}\nEmail: ${customerData.customer_email}`;
            const qrCodeBuffer = await QRCode.toBuffer(qrData);
            doc.image(qrCodeBuffer, 400, textYPosition, { width: 120, height: 120 });

            // Footer
            doc.fillColor("#ffffff").rect(0, 750, 595, 50).fill("#2563eb");
            doc.fillColor("#ffffff").fontSize(10).text("Created by Poovarasan S.", 50, 765);
            doc.text("Email: poovarasansivakumar2003@gmail.com", 50, 780);

            // Finish PDF generation
            doc.end();
            outputStream.on("finish", resolve);
            outputStream.on("error", reject);
        } catch (err) {
            reject(err);
        }
    });
}

// Download customer card
exports.downloadCustomerCard = [isCustomer, (req, res) => {
    const filePath = path.join(__dirname, "../private/customerCards", req.params.filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        console.error("File Not Found:", filePath);
        return res.status(404).render("404", {
            username: req.session.user?.username,
            profile: "customer",
            pagetitle: "Page Not Found",
            error: "File Not Found"
        });
    }

    // Set headers for downloading the file
    res.setHeader("Content-Disposition", `attachment; filename="${req.params.filename}"`);

    // Send the file
    res.download(filePath, (err) => {
        if (err) {
            console.error("Download Error:", err);
            res.status(500).render("404", {
                username: req.session.user?.username,
                profile: "customer",
                pagetitle: "Internal Server Error",
                error: "Failed to download the file"
            });
        }
    });
}];


exports.downloadInvoice = [isCustomer, async (req, res) => {
    try {
        const { invoiceNo } = req.params;

        // Fetch invoice data
        const [invoiceData] = await pool.query(`
            SELECT 
            i.invoice_no, 
            i.invoice_time, 
            a.admin_username, 
            GROUP_CONCAT(m.medicine_name ORDER BY m.medicine_name SEPARATOR ', ') AS medicine_names,
            GROUP_CONCAT(m.medicine_composition ORDER BY m.medicine_name SEPARATOR ', ') AS medicine_compositions,
            GROUP_CONCAT(COALESCE(s.supplier_name, 'Unknown') ORDER BY m.medicine_name SEPARATOR ', ') AS supplier_names,
            GROUP_CONCAT(DATE_FORMAT(m.medicine_expiry_date, '%Y-%m-%d') ORDER BY m.medicine_name SEPARATOR ', ') AS medicine_expiry_dates,
            GROUP_CONCAT(m.medicine_price ORDER BY m.medicine_name SEPARATOR ', ') AS medicine_prices,
            GROUP_CONCAT(p.purchased_quantity ORDER BY m.medicine_name SEPARATOR ', ') AS purchased_quantities,
            GROUP_CONCAT(p.total_amt ORDER BY m.medicine_name SEPARATOR ', ') AS total_amt,
            ps.actual_amt_to_pay,
            i.prev_balance, 
            i.total_amt_to_pay,
            i.discount,
            i.net_total,
            py.payment_amt AS amount_paid, 
            py.payment_time AS payment_date,
            i.curr_balance    
            FROM invoice i
            JOIN purchase_sessions ps ON i.purchase_session_id = ps.purchase_session_id 
            JOIN purchases p ON ps.customer_id = p.customer_id AND ps.purchase_time = p.purchase_time
            JOIN medicines m ON p.medicine_id = m.medicine_id
            LEFT JOIN suppliers s ON p.supplier_id = s.supplier_id
            JOIN customers c ON ps.customer_id = c.customer_id  
            LEFT JOIN admin a ON i.admin_username = a.admin_username  
            LEFT JOIN payments py ON i.payment_id = py.payment_id  
            WHERE i.invoice_no = ?
            GROUP BY i.invoice_no
            ORDER BY i.invoice_time DESC
        `, [invoiceNo]);

        if (invoiceData.length === 0) {
            return res.status(404).render("404", {
                username: req.session.user?.username,
                profile: "customer",
                pagetitle: "Page Not Found",
                error: "Invoice not found"
            });
        }

        const invoice = invoiceData[0];

        // Ensure the 'invoices' directory exists
        const invoicesDir = path.join(__dirname, "../private/invoices");
        if (!fs.existsSync(invoicesDir)) {
            fs.mkdirSync(invoicesDir, { recursive: true });
        }

        // Define file path
        const filePath = path.join(invoicesDir, `invoice_${invoiceNo}.pdf`);
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Page margins
        const margin = 20;
        const pageWidth = 600;
        const contentWidth = pageWidth - (margin * 2);

        // Header Section - centered with proper spacing
        doc.rect(0, 0, pageWidth, 70).fill("#2563eb");
        doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(24).text("MediVerse Pharmacy", margin, 25, {
            width: contentWidth,
            align: "center"
        });

        // Company Logo - properly positioned
        const iconPath = path.join(__dirname, "../public/img/favicon.png");
        if (fs.existsSync(iconPath)) {
            doc.image(iconPath, pageWidth - margin - 50, 10, { width: 50 });
        }

        // Invoice Details - centered title, aligned details
        doc.fillColor("#000").fontSize(16).text(`Invoice #${invoice.invoice_no}`, margin, 85, {
            width: contentWidth,
            align: "center"
        });

        // Two column layout for invoice details
        doc.fontSize(11).font("Helvetica");
        doc.text(`Date: ${new Date(invoice.invoice_time).toLocaleString()}`, margin, 110);
        doc.text(`Admin: ${invoice.admin_username || "N/A"}`, pageWidth - 200, 110);

        // Table Header - properly spaced and aligned
        const headerY = 140;
        doc.font("Helvetica-Bold").fontSize(10);

        // Balanced column positions
        const columnPositions = {
            medicineName: margin,
            composition: margin + 110,
            supplier: margin + 215,
            expiryDate: margin + 320,
            qty: margin + 390,
            unitPrice: margin + 440,
            total: margin + 490
        };

        const columnWidths = {
            medicineName: 100,
            composition: 100,
            supplier: 100,
            expiryDate: 70,
            qty: 40,
            unitPrice: 50,
            total: 50
        };

        // Table headers
        doc.text("Medicine Name", columnPositions.medicineName, headerY, { width: columnWidths.medicineName });
        doc.text("Composition", columnPositions.composition, headerY, { width: columnWidths.composition });
        doc.text("Supplier", columnPositions.supplier, headerY, { width: columnWidths.supplier });
        doc.text("Expiry Date", columnPositions.expiryDate, headerY, { width: columnWidths.expiryDate });
        doc.text("Qty", columnPositions.qty, headerY, { width: columnWidths.qty, align: "right" });
        doc.text("Unit Price", columnPositions.unitPrice, headerY, { width: columnWidths.unitPrice, align: "right" });
        doc.text("Total", columnPositions.total, headerY, { width: columnWidths.total, align: "right" });

        // Draw Header Line
        doc.strokeColor("#000").lineWidth(1).moveTo(margin, headerY + 15).lineTo(pageWidth - margin, headerY + 15).stroke();

        // Table Content - Optimize row height
        doc.font("Helvetica").fontSize(10);
        let currentY = headerY + 25;
        const lineHeight = 22; // Proper row height for readability

        // Parse and prepare the data arrays
        const medicineNames = invoice.medicine_names.split(", ");
        const compositions = invoice.medicine_compositions.split(", ");
        const suppliers = invoice.supplier_names.split(", ");
        const expiryDates = invoice.medicine_expiry_dates.split(", ");
        const quantities = invoice.purchased_quantities.split(", ");
        const prices = invoice.medicine_prices.split(", ");

        // Calculate individual total prices
        const totalPrices = [];
        for (let i = 0; i < medicineNames.length; i++) {
            totalPrices.push((parseFloat(quantities[i]) * parseFloat(prices[i])).toFixed(2));
        }

        // Format currency function
        const formatCurrency = (value) => `₹${parseFloat(value).toFixed(2)}`;

        // Maximum number of items to display (to prevent overflow)
        const maxItems = Math.min(medicineNames.length, 15); // Limit items if needed

        // Render invoice table rows with proper spacing
        for (let i = 0; i < maxItems; i++) {
            doc.text(medicineNames[i], columnPositions.medicineName, currentY, { width: columnWidths.medicineName });
            doc.text(compositions[i], columnPositions.composition, currentY, { width: columnWidths.composition });
            doc.text(suppliers[i], columnPositions.supplier, currentY, { width: columnWidths.supplier });
            doc.text(expiryDates[i], columnPositions.expiryDate, currentY, { width: columnWidths.expiryDate });
            doc.text(quantities[i], columnPositions.qty, currentY, { width: columnWidths.qty, align: "right" });
            doc.text(formatCurrency(prices[i]), columnPositions.unitPrice, currentY, { width: columnWidths.unitPrice, align: "right" });
            doc.text(formatCurrency(totalPrices[i]), columnPositions.total, currentY, { width: columnWidths.total, align: "right" });

            currentY += lineHeight;
        }

        // Draw a separator line before the summary
        doc.strokeColor("#000").lineWidth(0.5).moveTo(margin, currentY + 10).lineTo(pageWidth - margin, currentY + 10).stroke();
        currentY += 25;

        // Billing Summary - Properly aligned
        const summaryLabelX = pageWidth - 250;
        const summaryValueX = pageWidth - margin - 50;

        doc.font("Helvetica-Bold").fontSize(12).text("Billing Summary", summaryLabelX, currentY);
        currentY += 20;

        // Properly spaced billing summary with consistent alignment
        doc.font("Helvetica").fontSize(10);
        doc.text("Total Amount:", summaryLabelX, currentY);
        doc.text(formatCurrency(invoice.total_amt_to_pay), summaryValueX, currentY, { align: "right" });
        currentY += lineHeight - 5;

        doc.text("Previous Balance:", summaryLabelX, currentY);
        doc.text(formatCurrency(invoice.prev_balance), summaryValueX, currentY, { align: "right" });
        currentY += lineHeight - 5;

        doc.text("Discount:", summaryLabelX, currentY);
        doc.text(formatCurrency(invoice.discount), summaryValueX, currentY, { align: "right" });
        currentY += lineHeight - 5;

        // Draw a line before net total
        doc.strokeColor("#000").lineWidth(0.5).moveTo(summaryLabelX, currentY).lineTo(summaryValueX, currentY).stroke();
        currentY += 10;

        doc.font("Helvetica-Bold");
        doc.text("Net Total:", summaryLabelX, currentY);
        doc.text(formatCurrency(invoice.net_total), summaryValueX, currentY, { align: "right" });
        currentY += lineHeight;

        doc.fillColor("#008000");
        doc.text("Amount Paid:", summaryLabelX, currentY);
        doc.text(formatCurrency(invoice.amount_paid), summaryValueX, currentY, { align: "right" });
        currentY += lineHeight - 5;

        doc.fillColor("#ff0000");
        doc.text("Current Balance:", summaryLabelX, currentY);
        doc.text(formatCurrency(invoice.curr_balance), summaryValueX, currentY, { align: "right" });

        // Footer at the bottom
        const footerHeight = 40;
        const footerY = 752 - footerHeight;

        doc.fillColor("#000000");
        doc.rect(0, footerY, pageWidth, footerHeight).fill("#2563eb");

        doc.fillColor("#ffffff").fontSize(10)
            .text("Created by Poovarasan S.", margin, footerY + 15)
            .text("Email: poovarasansivakumar2003@gmail.com", margin + 250, footerY + 15);

        doc.end();

        // Send PDF after generation
        stream.on("finish", () => {
            res.download(filePath, `invoice_${invoiceNo}.pdf`, (err) => {
                if (err) console.error("Error downloading file:", err);
            });
        });

    } catch (error) {
        console.error("Error generating invoice:", error);
        res.status(500).render("500", {
            username: req.session.user?.username,
            profile: "customer",
            pagetitle: "Internal Server Error",
            error: error.message
        });
    }
}];





// exports.purchaseMedicine = [isCustomer, async (req, res) => {
//     try {
//         const { medicineId, quantity } = req.body;
//         const customerId = req.session.customerId;

//         // Fetch medicine price
//         const [medicine] = await pool.query('SELECT medicine_price FROM medicines WHERE medicine_id = ?', [medicineId]);

//         if (!medicine.length) {
//             return res.status(404).render("400", {
//                 profile: req.session.user?.role,
//                 username: req.session.user?.username,
//                 pagetitle: "Bad Request",
//                 error: "Invalid medicine ID"
//             });
//         }

//         // Insert purchase record
//         await pool.query(
//             'INSERT INTO purchases (customer_id, medicine_id, purchased_quantity) VALUES (?, ?, ?)',
//             [customerId, medicineId, quantity]
//         );

//         res.render("success", {
//             pdfName: null,
//             username: req.session.user?.username,
//             profile: "customer",
//             pagetitle: "Success",
//             message: "Added to cart, wait for admin approval"
//         });
//     } catch (err) {
//         console.error("Database Error:", err);
//         res.status(500).render("500", {
//             username: req.session.user?.username,
//             profile: "customer",
//             pagetitle: "Internal Server Error",
//             error: err.message
//         });
//     }
// }];