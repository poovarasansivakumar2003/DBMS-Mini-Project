const fs = require('fs');
const pool = require('../db');
const bcrypt = require("bcryptjs");
const multer = require('multer');
const path = require('path');
const PDFDocument = require("pdfkit");

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
        // Fetch customer details
        const [customerResult] = await pool.query('SELECT c.customer_id, c.customer_created_at, c.customer_name, c.customer_email, c.customer_ph_no, c.customer_photo, c.customer_balance_amt FROM customers c WHERE c.customer_id = ?', [customerId]);
        const [addressResult] = await pool.query('SELECT ca.address_type, ca.street, ca.city, ca.state, ca.zip_code FROM customer_addresses ca WHERE ca.customer_id = ?', [customerId]);
        const [feedbackResult] = await pool.query('SELECT f.rating, f.feedback_text, f.feedback_date FROM feedbacks f WHERE f.customer_id = ?', [customerId]);


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
        const invoicesDir = path.join(__dirname, "../invoices");
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

exports.updateCustomer = [isCustomer, async (req, res) => {
    upload.single("customer_photo")(req, res, async (err) => {
        if (err) {
            console.error("Multer error:", err);
            return res.status(500).render("500", {
                username: req.session.user?.username,
                profile: "customer",
                pagetitle: "Internal Server Error",
                error: "Multer error"
            });
        }
    });

    try {
        const customerId = req.session.customerId;
        const { customer_name, customer_email, customer_ph_no, customer_password } = req.body;

        if (customer_password.length < 8) {
            // Clean up uploaded file if exists
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }

            return res.render("customerRegister", {
                username: req.session.user?.username,
                profile: "customer",
                pagetitle: "Customer Register",
                error: "Password must be at least 8 characters"
            });
        }

        const hashedPassword = await bcrypt.hash(customer_password.trim(), 10);
        let customerPhoto = null;
        if (req.file) {
            customerPhoto = req.file.buffer;
            fs.unlinkSync(req.file.path);
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
        if (hashedPassword) {
            updateFields.push("customer_password = ?");
            updateValues.push(hashedPassword);
        }
        if (customerPhoto) {
            updateFields.push("customer_photo = ?");
            updateValues.push(customerPhoto);
        }

        if (updateFields.length > 0) {
            updateValues.push(customerId);
            await pool.query(
                `UPDATE customers SET ${updateFields.join(", ")} WHERE customer_id = ?`,
                updateValues
            );
        }

        // Fetch updated customer details
        const [customerResult] = await pool.query(`
            SELECT customer_id, customer_created_at, customer_name, customer_email, customer_ph_no, customer_photo, customer_balance_amt
            FROM customers WHERE customer_id = ?`,
            [customerId]
        );

        if (!customerResult.length) {
            return res.status(404).render("404", {
                username: req.session.user?.username,
                profile: "customer",
                pagetitle: "Page Not Found",
                error: "Customer not found"
            });
        }
        const customer = customerResult[0];

        // Fetch all addresses for the customer
        const [addresses] = await pool.query(
            "SELECT address_type, street, city, state, zip_code FROM customer_addresses WHERE customer_id = ?",
            [customerId]
        );

        // Fetch all feedbacks for the customer
        const [feedbacks] = await pool.query(
            "SELECT rating, feedback_text, feedback_date FROM feedbacks WHERE customer_id = ? ORDER BY feedback_date DESC",
            [customerId]
        );

        // Generate PDF to file
        const pdfFileName = `${customer_id}_card.pdf`;
        const pdfPath = path.join(__dirname, "../private/customerCards", pdfFileName);
        const pdfStream = fs.createWriteStream(pdfPath);

        await generateCustomerPDF(customer, addresses, feedbacks, pdfStream);

        // Wait for PDF to finish writing
        pdfStream.on('finish', () => {
            // Render success page
            res.render("success", {
                pdfName: pdfFileName,
                username: req.session.user?.username,
                profile: "customer",
                pagetitle: "Success",
                message: 'Your Profile updated successfully!'
            });
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

async function generateCustomerPDF(customerData, outputStream) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: "A4", margin: 50 });
            doc.pipe(outputStream);

            // Header Section
            doc.rect(0, 0, 595, 80).fill("#2563eb");
            doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(24).text("MediVerse", 50, 30);

            // Company Logo
            const iconPath = path.join(__dirname, "../public/img/favicon.png");
            if (fs.existsSync(iconPath)) {
                doc.image(iconPath, 500, 20, { width: 50 });
            }

            let yPosition = 100;

            // Customer Photo (if available)
            if (customerData.customer_photo) {
                doc.roundedRect(50, yPosition, 100, 100, 10).stroke();
                doc.image(customerData.customer_photo, 55, yPosition + 5, { fit: [90, 90] });
            }

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

            addDetailRow("Customer ID:", customer.customer_id || "N/A");
            addDetailRow("Registered On:", customer.customer_created_at || "N/A");
            textYPosition += 20;
            addDetailRow("Name:", customer.customer_name || "N/A");
            addDetailRow("Email:", customer.customer_email || "N/A");
            addDetailRow("Phone Number:", customer.customer_ph_no || "N/A");
            addDetailRow("Phone Number:", customer.customer_balance_amt || "N/A");
            const addItems = Math.min(addresses.length, 5);

        // Render invoice table rows with proper spacing
        for (let i = 0; i < addItems; i++) {
            addDetailRow("Address Type:", addresses.address_type[i] || "N/A");
            addDetailRow("Street:", addresses.street[i] || "N/A");
            addDetailRow("City:", addresses.city[i] || "N/A");
            addDetailRow("State:", addresses.state[i] || "N/A");
            addDetailRow("Zip Code:", addresses.zip_code[i] || "N/A");
        }
        const fedItems = Math.min(feedbacks.length, 5);

        // Render invoice table rows with proper spacing
        for (let i = 0; i < fedItems; i++) {
            addDetailRow("Feedback Date:", feedbacks.feedback_date || "N/A");
            addDetailRow("Rating", feedbacks.rating || "N/A");
            addDetailRow("Feedback text:", feedbacks.feedback_text || "N/A");
        }
            // QR Code Section - Properly Aligned
            textYPosition += 30;
            doc.fontSize(14).fillColor("#2563eb").text("Scan QR for Details", 400, textYPosition);
            textYPosition += 20;

            QRCode.toBuffer(
                `Customer ID: ${customerData.customer_id}\nName: ${customerData.customer_name}\nPhone: ${customerData.customer_ph_no}\nEMAIL: ${customerData.customer_email}`
            )
                .then(qrCodeBuffer => {
                    doc.image(qrCodeBuffer, 55, textYPosition, { width: 120, height: 120 });

                    // Footer Section with Proper Spacing
                    doc.rect(0, 750, 595, 50).fill("#2563eb");
                    doc.fillColor("#ffffff").fontSize(10).text("Created by Poovarasan S.", 50, 765);
                    doc.text("Email: poovarasansivakumar2003@gmail.com", 50, 780);


                    doc.end();
                    resolve();
                })
                .catch(err => reject(err));
        } catch (err) {
            reject(err);
        }
    });
}

// Download customer card
exports.downloadCustomerCard = (req, res) => {
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
};

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