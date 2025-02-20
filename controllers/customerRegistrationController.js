const express = require("express");
const fs = require("fs");
const pool = require("../db");
const path = require("path");
const bcrypt = require("bcryptjs");
const PDFDocument = require("pdfkit");
const multer = require("multer");
const QRCode = require("qrcode");

// Ensure private directories exist
const privateDirs = ["../private/uploads/customersPhotos", "../private/customerCards", "../private/customerQrcodes"];
privateDirs.forEach((dir) => fs.mkdirSync(path.join(__dirname, dir), { recursive: true }));

// Configure Multer for File Uploads
const uploadDir = path.join(__dirname, "../private/uploads/customersPhotos");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`),
});

const upload = multer({ storage });

// Serve static files
const app = express();
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
            return res.status(500).render("500", { error: "Multer error" });
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
                    error: "Customer with this email or phone number already exists"
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
                    const newFilePath = path.join(uploadDir, newFileName);

                    // Renaming file and update customer photo in database
                    fs.renameSync(req.file.path, newFilePath);
                    customer_photo = newFilePath;

                    await connection.query("UPDATE customers SET customer_photo = ? WHERE customer_id = ?", [customer_photo, customer_id]);
                }

                // Generate PDF Card for the customer
                const pdfDir = path.join(__dirname, "../private/customerCards");
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
                    pdfPath: `/private/customerCards/${customer_id}_card.pdf`,
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
        const doc = new PDFDocument({ size: "A4", margin: 40 });
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        // Header with Mediverse Brand and Symbol
        doc.rect(0, 0, doc.page.width, 100).fill("#0D6EFD");
        doc.fill("#ffffff").fontSize(24).font("Helvetica-Bold").text("MediVerse", doc.page.width / 2 - 50, 40, { align: "center" });
        doc.fontSize(16).font("Helvetica").text("A Smarter, Faster, and Seamless Way to Manage Your Pharmacy.", doc.page.width / 2 - 200, 70, { align: "center" }); // Tagline

        // Mediverse Brand Symbol (assuming you have a FontAwesome icon image)
        const iconPath = path.join(__dirname, "path_to_fontawesome_icon_image.png"); // Replace with actual image path
        if (fs.existsSync(iconPath)) {
            doc.image(iconPath, doc.page.width - 60, 70, { width: 30, height: 30 });
        } else {
            console.warn("Mediverse symbol icon not found!");
        }

        // Customer Photo
        if (customerData.customer_photo) {
            const customerPhotoPath = path.resolve(customerData.customer_photo);  

            if (fs.existsSync(customerPhotoPath) && fs.lstatSync(customerPhotoPath).isFile()) {
                doc.image(customerPhotoPath, 50, 120, { width: 100, height: 100 });
            } else {
                console.warn("Customer photo not found:", customerPhotoPath);
            }
        }

        // Customer Details Section (Properly aligned)
        doc.font("Helvetica-Bold").fontSize(14).fill("#333").text("Customer ID:", 50, 240);
        doc.font("Helvetica").fontSize(14).text(customerData.customer_id, 200, 240);

        doc.font("Helvetica-Bold").fontSize(14).text("Name:", 50, 270);
        doc.font("Helvetica").fontSize(14).text(customerData.customer_name, 200, 270);

        doc.font("Helvetica-Bold").fontSize(14).text("Email:", 50, 300);
        doc.font("Helvetica").fontSize(14).text(customerData.customer_email, 200, 300);

        // Adding Customer Phone Number and Address
        doc.font("Helvetica-Bold").fontSize(14).text("Phone Number:", 50, 330);
        doc.font("Helvetica").fontSize(14).text(customerData.customer_ph_no, 200, 330);

        doc.font("Helvetica-Bold").fontSize(14).text("Address:", 50, 360);
        doc.font("Helvetica").fontSize(14).text(customerData.customer_address || "N/A", 200, 360);

        // Generate QR Code
        const qrCodeData = `Customer ID: ${customerData.customer_id}\nName: ${customerData.customer_name}\nPhone: ${customerData.customer_ph_no}`;
        const qrCodePath = path.join(__dirname, "../private/customerQrcodes", `${customerData.customer_id}.png`);
        fs.mkdirSync(path.dirname(qrCodePath), { recursive: true });

        await QRCode.toFile(qrCodePath, qrCodeData);
        if (fs.existsSync(qrCodePath)) {
            doc.image(qrCodePath, doc.page.width - 150, 120, { width: 100, height: 100 });
        }

        // Footer Section (Aligned with name, email, and tagline)
        doc.rect(0, doc.page.height - 80, doc.page.width, 80).fill("#0D6EFD");
        doc.font("Helvetica").fill("#ffffff").fontSize(12).text("Created by Poovarasan S.", 50, doc.page.height - 60);
        doc.font("Helvetica").fill("#ffffff").fontSize(12).text("Email: poovarasansivakumar2003@gmail.com", 50, doc.page.height - 40);
        doc.font("Helvetica").fill("#ffffff").fontSize(12).text("A Smarter, Faster, and Seamless Way to Manage Your Pharmacy!", doc.page.width - 200, doc.page.height - 40, { align: "right" });

        // Finalize the document
        doc.end();
        stream.on("finish", () => { resolve(); });
        stream.on("error", (err) => { reject(err); });
    });
}

// Handle PDF Download
exports.downloadCustomerCard = (req, res) => {
    const filePath = path.join(__dirname, "../private/customerCards", req.params.filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        console.error("File Not Found:", filePath);
        return res.status(404).send("File Not Found");
    }

    res.setHeader("Content-Disposition", `attachment; filename="${req.params.filename}"`);
    res.download(filePath, (err) => {
        if (err) 
            console.error("Download Error:", err);
    });
};
