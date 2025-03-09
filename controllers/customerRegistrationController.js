const express = require("express");
const app = express();
const fs = require("fs");
const pool = require("../db");
const path = require("path");
const bcrypt = require("bcryptjs");
const PDFDocument = require("pdfkit");
const multer = require("multer");
const QRCode = require("qrcode");
require("dotenv").config();

// Ensure private directories exist
const privateDirs = ["../private/uploads/customersPhotos", "../private/customerCards"];
privateDirs.forEach((dir) => fs.mkdirSync(path.join(__dirname, dir), { recursive: true }));

// Configure Multer for File Uploads
const uploadDir = path.join(__dirname, "../private/uploads/customersPhotos");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`),
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
const upload = multer({storage,fileFilter});

// Serve static files
app.use("/private/customerCards", express.static(path.join(__dirname, "../private/customerCards")));

// Render Customer Registration Page
exports.getCustomerRegister = (req, res) => {
    res.render("customerRegister", {
        profile: req.session.user?.role,
        username: req.session.user?.username,
        pagetitle: "Customer Register"
    });
};

// Handle Customer Registration
exports.customerRegister = async (req, res) => {
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
            const { customer_name, customer_email, customer_ph_no, customer_address, customer_password } = req.body;

            // Check for existing customer email/phone in one query
            const [existingCustomer] = await pool.query(
                "SELECT customer_id FROM customers WHERE customer_email = ? OR customer_ph_no = ?",
                [customer_email, customer_ph_no]
            );

            if (existingCustomer.length > 0) {
                return res.status(400).render("400", {
                    profile: req.session.user?.role,
                    username: req.session.user?.username,
                    pagetitle: "Bad Request",
                    error: "Customer with this email or phone number already exists"
                });
            }

            // Validate password
            if (!customer_password || customer_password.length < 8) {
                return res.render("customerRegister", { 
                    profile: req.session.user?.role,
                    username: req.session.user?.username,
                    pagetitle: "Customer Register",
                    error: "Password must be at least 8 characters"
                });
            }

            // Hash password and use transaction for multiple queries
            const hashedPassword = await bcrypt.hash(customer_password.trim(), 10);

            // Using transaction to handle multiple database operations
            const connection = await pool.getConnection();
            await connection.beginTransaction();

            try {
                const [result] = await connection.query(
                    `INSERT INTO customers (customer_name, customer_email, customer_ph_no, customer_address, customer_password)
                     VALUES (?, ?, ?, ?, ?)`,
                    [customer_name, customer_email, customer_ph_no, customer_address || null, hashedPassword]
                );

                const customer_id = result.insertId;
                let customer_photo = "";
                if (req.file) {
                    const ext = path.extname(req.file.originalname);
                    const newFileName = `${customer_id}_photo${ext}`;
                    const relativePath = `./private/uploads/customersPhotos/${newFileName}`;
                    const newFilePath = path.join(uploadDir, newFileName);

                    fs.renameSync(req.file.path, newFilePath);
                    customer_photo = relativePath;

                    // Store relative path in the database
                    await connection.query("UPDATE customers SET customer_photo = ? WHERE customer_id = ?", [customer_photo, customer_id]);
                }

                // Generate PDF Card for the customer
                const pdfDir = path.join(process.cwd(), "private/customerCards");
                const pdfPath = path.join(pdfDir, `${customer_id}_card.pdf`);
                fs.mkdirSync(pdfDir, { recursive: true });

                await generateCustomerPDF({
                    customer_id,
                    customer_name,
                    customer_email,
                    customer_ph_no,
                    customer_photo,
                    customer_address,
                }, pdfPath);

                await connection.commit();

                // Render success page
                res.render("success", {
                    pdfName: `${customer_id}_card.pdf`,
                    profile: req.session.user?.role,
                    username: req.session.user?.username,
                    pagetitle: "Success",
                    message: 'Your account has been created successfully.'
                });

            } catch (err) {
                console.error("Transaction error:", err);
                await connection.rollback();
                res.render("customerRegister", {
                    profile: req.session.user?.role,
                    username: req.session.user?.username,
                    pagetitle: "Customer Register",
                    error: err.message
                });
            } finally {
                connection.release();
            }
        } catch (err) {
            console.error("Unexpected error:", err);
            res.render("customerRegister", {
                profile: req.session.user?.role,
                username: req.session.user?.username,
                pagetitle: "Customer Register",
                error: err.message
            });
        }
    });
};

// Generate Customer PDF
async function generateCustomerPDF(customerData, filePath) {
    return new Promise(async (resolve, reject) => {
        // Create PDF with smaller margins to maximize space
        const doc = new PDFDocument({
            size: "A4",
            margin: 20,
            autoFirstPage: false
        });

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Add a single page with specific dimensions
        doc.addPage({
            size: "A4",
            margin: 20
        });

        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;

        // **Header Section** - Reduced height
        const headerHeight = 40;
        doc.rect(20, 20, pageWidth - 40, headerHeight)
            .fill("#2563eb");

        doc.fill("#ffffff")
            .font("Helvetica-Bold")
            .fontSize(20)
            .text("MediVerse", 40, 30);

        // **Mediverse Logo**
        const iconPath = path.join(__dirname, "../public/img/favicon.png");
        if (fs.existsSync(iconPath)) {
            doc.image(iconPath, pageWidth - 90, 25, { width: 30 });
        }

        let yPosition = headerHeight + 40;

        // **Customer Photo** 
        if (customerData.customer_photo) {
            const customerPhotoPath = path.resolve(customerData.customer_photo);
            if (fs.existsSync(customerPhotoPath) && fs.lstatSync(customerPhotoPath).isFile()) {
                doc.image(customerPhotoPath, 40, yPosition, { width: 60, height: 60 });
            }
        }

        // **Customer Details** - Optimized spacing
        const textStartX = 120;
        const labelWidth = 100;
        const fontSize = 12;

        doc.fontSize(fontSize).fillColor("#000000");

        // Function to add customer detail rows
        const addDetailRow = (label, value) => {
            doc.font("Helvetica-Bold").text(label, textStartX, yPosition);
            doc.font("Helvetica").text(value, textStartX + labelWidth, yPosition);
            yPosition += 20;
        };

        addDetailRow("Customer ID:", customerData.customer_id);
        addDetailRow("Name:", customerData.customer_name);
        addDetailRow("Email:", customerData.customer_email);
        addDetailRow("Phone Number:", customerData.customer_ph_no);

        // Address with controlled width
        doc.font("Helvetica-Bold").text("Address:", textStartX, yPosition);
        doc.font("Helvetica").text(
            customerData.customer_address || "N/A",
            textStartX + labelWidth,
            yPosition,
            { width: 250 }
        );

        // **QR Code** - Moved to the right side
        const qrCodeData = `Customer ID: ${customerData.customer_id}\nName: ${customerData.customer_name}\nPhone: ${customerData.customer_ph_no}`;
        const qrCodeBuffer = await QRCode.toBuffer(qrCodeData);
        doc.image(qrCodeBuffer, pageWidth - 130, yPosition - 60,  { width: 80, height: 80 });

        // **Footer Section** - Positioned at bottom
        const footerHeight = 40;
        const footerMargin = 20;
        const footerY = pageHeight - footerHeight - footerMargin;
        const footerX = footerMargin;
        const footerWidth = pageWidth - 2 * footerMargin;

        // Draw footer background
        doc.rect(footerX, footerY, footerWidth, footerHeight).fill("#2563eb");

        // Set text color and font
        doc.fillColor("#ffffff").font("Helvetica").fontSize(10);

        // Left-aligned footer text
        doc.text("Created by Poovarasan S.", footerX + 10, footerY + 12);
        doc.text("Email: poovarasansivakumar2003@gmail.com", footerX + 10, footerY + 24);

        // Right-aligned footer text (Ensure it fits in a single line)
        const footerText = "A Smarter, Faster, and Seamless Way to Manage Your Pharmacy!";
        const footerTextWidth = doc.widthOfString(footerText); // Get text width
        const footerTextX = pageWidth - footerTextWidth - footerMargin - 10; // Calculate position

        doc.text(footerText, footerTextX, footerY + 15);

        // Finalize PDF
        doc.end();
        stream.on("finish", () => resolve());
        stream.on("error", (err) => reject(err));
    });
}



exports.downloadCustomerCard = (req, res) => {
    const filePath = path.join(__dirname, "../private/customerCards", req.params.filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        console.error("File Not Found:", filePath);
        return res.status(404).render("404", {
            profile: req.session.user?.role,
            username: req.session.user?.username,
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
                profile: req.session.user?.role,
                username: req.session.user?.username,
                pagetitle: "Internal Server Error",
                error: "Failed to download the file"
            });
        }
    });
};