const fs = require("fs");
const pool = require("../db");
const path = require("path");
const bcrypt = require("bcryptjs");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const multer = require("multer");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = path.join(__dirname, "../uploads");
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function(req, file, cb) {
    // Accept only image files
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

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
            const { customer_name, customer_email, customer_ph_no, customer_password, street, city, state, zip_code, address_type } = req.body;

            // Check for existing customer email/phone in one query
            const [existingCustomer] = await pool.query(
                "SELECT customer_id FROM customers WHERE customer_email = ? OR customer_ph_no = ?",
                [customer_email, customer_ph_no]
            );

            if (existingCustomer.length > 0) {
                // Clean up uploaded file if exists
                if (req.file && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
                
                return res.status(400).render("400", {
                    profile: req.session.user?.role,
                    username: req.session.user?.username,
                    pagetitle: "Bad Request",
                    error: "Customer with this email or phone number already exists"
                });
            }

            // Validate password
            if (!customer_password || customer_password.length < 8) {
                // Clean up uploaded file if exists
                if (req.file && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
                
                return res.render("customerRegister", { 
                    profile: req.session.user?.role,
                    username: req.session.user?.username,
                    pagetitle: "Customer Register",
                    error: "Password must be at least 8 characters"
                });
            }

            // Hash password and prepare customer photo
            const hashedPassword = await bcrypt.hash(customer_password.trim(), 10);
            let customer_photo = null;
            
            if (req.file) {
                customer_photo = fs.readFileSync(req.file.path);
                // Clean up after reading
                fs.unlinkSync(req.file.path);
            }
            
            // Using transaction to handle multiple database operations
            const connection = await pool.getConnection();
            await connection.beginTransaction();

            try {
                const [result] = await connection.query(
                    `INSERT INTO customers (customer_name, customer_email, customer_ph_no, customer_password, customer_photo, customer_balance_amt)
                     VALUES (?, ?, ?, ?, ?, 0.00)`,
                    [customer_name, customer_email, customer_ph_no, hashedPassword, customer_photo]
                );

                const customer_id = result.insertId;

                if (street || city || state || zip_code) {
                    await connection.query(
                        `INSERT INTO customer_addresses (customer_id, street, city, state, zip_code, address_type)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [customer_id, street || null, city || null, state || null, zip_code || null, address_type || 'Home']
                    );
                }

                await connection.commit();

                // Create directory for customer cards if it doesn't exist
                const cardsDir = path.join(__dirname, "../private/customerCards");
                if (!fs.existsSync(cardsDir)) {
                    fs.mkdirSync(cardsDir, { recursive: true });
                }

                // Generate PDF to file
                const pdfFileName = `${customer_id}_card.pdf`;
                const pdfPath = path.join(cardsDir, pdfFileName);
                const pdfStream = fs.createWriteStream(pdfPath);
                
                await generateCustomerPDF({
                    customer_id,
                    customer_name,
                    customer_email,
                    customer_ph_no,
                    customer_photo,
                    address_type,
                    street,
                    city,
                    state,
                    zip_code
                }, pdfStream);
                
                // Wait for PDF to finish writing
                pdfStream.on('finish', () => {
                    // Render success page
                    res.render("success", {
                        pdfName: pdfFileName,
                        profile: req.session.user?.role,
                        username: req.session.user?.username,
                        pagetitle: "Success",
                        message: 'Your account has been created successfully.'
                    });
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
            // Clean up uploaded file if exists
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            
            res.render("customerRegister", {
                profile: req.session.user?.role,
                username: req.session.user?.username,
                pagetitle: "Customer Register",
                error: err.message
            });
        }
    });
};

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

            addDetailRow("Customer ID:", customerData.customer_id || "N/A");
            addDetailRow("Name:", customerData.customer_name || "N/A");
            addDetailRow("Email:", customerData.customer_email || "N/A");
            addDetailRow("Phone Number:", customerData.customer_ph_no || "N/A");
            addDetailRow("Address Type:", customerData.address_type || "N/A");
            addDetailRow("Street:", customerData.street || "N/A");
            addDetailRow("City:", customerData.city || "N/A");
            addDetailRow("State:", customerData.state || "N/A");
            addDetailRow("Zip Code:", customerData.zip_code || "N/A");

            // QR Code Section - Properly Aligned
            textYPosition += 30;
            doc.fontSize(14).fillColor("#2563eb").text("Scan QR for Details", 400, textYPosition);
            textYPosition += 20;

            QRCode.toBuffer(
                `Customer ID: ${customerData.customer_id}\nName: ${customerData.customer_name}\nPhone: ${customerData.customer_ph_no}`
            )
                .then(qrCodeBuffer => {
                    doc.image(qrCodeBuffer, 400, textYPosition, { width: 120, height: 120 });

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