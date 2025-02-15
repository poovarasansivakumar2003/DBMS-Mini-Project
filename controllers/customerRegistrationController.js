const express = require("express");
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

            // Check if email or phone number already exists
            const [existingCustomer] = await pool.query(
                "SELECT customer_id FROM customers WHERE customer_email = ? OR customer_ph_no = ?",
                [customer_email, customer_ph_no]
            );
            
            if (existingCustomer.length > 0) {
                return res.status(400).render("400", {
                    error: "Customer with this email or phone number already exists"
                });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(customer_password.trim(), 10);

            // Insert customer data without photo initially
            const [result] = await pool.query(
                `INSERT INTO customers (customer_name, customer_email, customer_ph_no, customer_address, customer_password)
                 VALUES (?, ?, ?, ?, ?)`,
                [customer_name, customer_email, customer_ph_no, customer_address || null, hashedPassword]
            );

            const customer_id = result.insertId;

            // Rename customer photo file correctly
            let customer_photo = "";
            if (req.file) {
                const ext = path.extname(req.file.originalname);
                const newFileName = `${customer_id}_photo${ext}`;
                const newFilePath = path.join(uploadDir, newFileName);
                try {
                    fs.renameSync(req.file.path, newFilePath);
                    customer_photo = newFilePath;  
                } catch (renameErr) {
                    console.error("Error renaming file:", renameErr);
                }
            }

            // Update photo path in the database
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
                pdfPath: `/private/customerCards/${customer_id}_card.pdf`,
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
        doc.rect(0, 0, doc.page.width, 100).fill("#0D6EFD");
        doc.fill("#ffffff").fontSize(24).font("Helvetica-Bold").text("Mediverse", 50, 40, { align: "center" });

        // Customer Photo
        if (customerData.customer_photo) {
            const customerPhotoPath = path.resolve(customerData.customer_photo);  

            if (fs.existsSync(customerPhotoPath) && fs.lstatSync(customerPhotoPath).isFile()) {
                doc.image(customerPhotoPath, 50, 120, { width: 100, height: 100 });
            } else {
                console.warn("Customer photo not found:", customerPhotoPath);
            }
        }

        // Generate QR Code
        const qrCodeData = `Customer ID: ${customerData.customer_id}\nName: ${customerData.customer_name}\nPhone: ${customerData.customer_ph_no}`;
        const qrCodePath = path.join(__dirname, "../private/customerQrcodes", `${customerData.customer_id}.png`);
        fs.mkdirSync(path.dirname(qrCodePath), { recursive: true });

        await QRCode.toFile(qrCodePath, qrCodeData);
        if (fs.existsSync(qrCodePath)) {
            doc.image(qrCodePath, doc.page.width - 150, 120, { width: 100, height: 100 });
        }

        // Customer Details
        doc.font("Helvetica-Bold").fontSize(14).fill("#333").text("Customer ID:", 50, 240);
        doc.font("Helvetica").fontSize(14).text(customerData.customer_id, 200, 240);

        doc.font("Helvetica-Bold").fontSize(14).text("Name:", 50, 270);
        doc.font("Helvetica").fontSize(14).text(customerData.customer_name, 200, 270);

        doc.font("Helvetica-Bold").fontSize(14).text("Email:", 50, 300);
        doc.font("Helvetica").fontSize(14).text(customerData.customer_email, 200, 300);

        doc.end();
        stream.on("finish", () => { resolve();});
        stream.on("error", (err) => { reject(err);});
    });
}

// Handle PDF Download
exports.downloadCustomerCard = (req, res) => {
    const filePath = path.join(__dirname, "../private/customerCards", req.params.filename);

    // Debugging: Log file path before sending
    console.log("📂 Attempting to download:", filePath);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        console.error("❌ File Not Found:", filePath);
        return res.status(404).send("File Not Found");
    }

    res.setHeader("Content-Disposition", `attachment; filename="${req.params.filename}"`);
    res.download(filePath, (err) => {
        if (err) console.error("❌ Download Error:", err);
    });
};
