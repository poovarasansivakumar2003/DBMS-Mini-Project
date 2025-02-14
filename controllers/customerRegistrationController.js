const express = require("express");
const pool = require("../db");
const path = require("path");
const bcrypt = require("bcryptjs");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const multer = require("multer");
const QRCode = require("qrcode");

const app = express();
app.use(express.static(path.join(__dirname, "private")));

// Configure Multer for File Uploads
const uploadDir = path.join(__dirname, "../private/uploads/customersPhotos");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage });

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
            
            // Check if phone number already exists
            const [existingCustomer] = await pool.query(
                "SELECT customer_id FROM customers WHERE customer_ph_no = ?",
                [customer_ph_no]
            );
            if (existingCustomer.length > 0) {
                return res.status(400).render("400", { error: "Customer already exists" });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(customer_password.trim(), 10);

            // Insert customer data
            const [result] = await pool.query(
                `INSERT INTO customers (customer_name, customer_email, customer_ph_no, customer_photo, customer_address, customer_password)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [customer_name, customer_email, customer_ph_no, "", customer_address || null, hashedPassword]
            );
            const customer_id = result.insertId;
            
            // Rename customer photo file
            let customer_photo = null;
            if (req.file) {
                customer_photo = path.join(uploadDir, `${customer_id}_photo${path.extname(req.file.originalname)}`);
                fs.renameSync(req.file.path, customer_photo);
            }

            // Update database with the new photo path
            await pool.query("UPDATE customers SET customer_photo = ? WHERE customer_id = ?", [customer_photo, customer_id]);

            // Generate PDF
            const pdfDir = path.join(__dirname, "../private/customerCards");
            fs.mkdirSync(pdfDir, { recursive: true });

            const pdfPath = path.join(pdfDir, `${customer_id}_card.pdf`);
            await generateCustomerPDF({
                customer_id,
                customer_name,
                customer_email,
                customer_ph_no,
                customer_photo,
                customer_address,
            }, pdfPath);

            res.render("success", {
                pdfName: `${customer_id}_card.pdf`,
                profile: req.session.user?.role,
                username: req.session.user?.username,
                pagetitle: "Success"
            });

        } catch (err) {
            console.error("Database error:", err);
            res.render("customerRegister", {
                profile: req.session.user?.role,
                username: req.session.user?.username,
                pagetitle: "Customer Register",
                error: 'Database error.',
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

        // Header
        doc.rect(0, 0, doc.page.width, 120).fill("#0D6EFD");
        doc.fill("#ffffff").fontSize(26).font("Helvetica-Bold").text("PHARMACY CUSTOMER CARD", 50, 50, { align: "center" });

        // Customer Details Card
        const cardY = 150;
        doc.roundedRect(50, cardY, doc.page.width - 100, 450, 10).fill("#ffffff").stroke("#D1D5DB");

        // Add Customer Photo
        if (customerData.customer_photo && fs.existsSync(customerData.customer_photo)) {
            doc.image(customerData.customer_photo, 70, cardY + 30, { width: 100, height: 100 });
        }

        // Generate QR Code
        const qrCodeData = `Customer ID: ${customerData.customer_id}\nName: ${customerData.customer_name}\nPhone: ${customerData.customer_ph_no}`;
        const qrCodePath = path.join(__dirname, "../private/customerQrcodes", `${customerData.customer_id}.png`);
        fs.mkdirSync(path.dirname(qrCodePath), { recursive: true });

        await QRCode.toFile(qrCodePath, qrCodeData);
        if (fs.existsSync(qrCodePath)) {
            doc.image(qrCodePath, doc.page.width - 170, cardY + 30, { width: 100, height: 100 });
        }

        // Customer Details
        const detailsStart = cardY + 160;
        doc.font("Helvetica-Bold").fontSize(16).fill("#0D6EFD").text("Customer Details", 70, detailsStart);
        doc.moveTo(70, detailsStart + 20).lineTo(doc.page.width - 70, detailsStart + 20).stroke("#D1D5DB");

        const details = [
            { label: "Customer ID", value: customerData.customer_id },
            { label: "Name", value: customerData.customer_name },
            { label: "Email", value: customerData.customer_email },
            { label: "Phone", value: customerData.customer_ph_no },
            { label: "Address", value: customerData.customer_address || "N/A" },
        ];

        details.forEach((detail, index) => {
            doc.font("Helvetica-Bold").fontSize(12).fill("#6B7280").text(`${detail.label}:`, 70, detailsStart + 40 + index * 40);
            doc.font("Helvetica").fontSize(14).fill("#1F2937").text(detail.value, 200, detailsStart + 40 + index * 40);
        });

        doc.end();
        stream.on("finish", resolve);
        stream.on("error", reject);
    });
}

// Handle PDF Download
exports.downloadCustomerCard = (req, res) => {
    const filePath = path.join(__dirname, "../private/customerCards", req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).send("File Not Found");
    res.download(filePath);
};
