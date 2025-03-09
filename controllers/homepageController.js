const path = require("path");
const pool = require("../db");
const fs = require('fs');

exports.getCustomerPhoto = (req, res) => {
    const filename = req.params.filename;
    const filePath = path.resolve(__dirname, "../private/uploads/customersPhotos", filename);
    const defaultPhotoPath = path.resolve(__dirname, "../private/uploads/customersPhotos/default_photo.jpg");

    // Validate filename to prevent directory traversal attacks
    if (!filename || !/^[a-zA-Z0-9._-]+$/.test(filename)) {
        return res.status(400).render("400", {
            username: req.session.user?.username,
            profile: req.session.user?.role,
            pagetitle: "Bad Request",
            error: "Invalid file request"
        });
    }
    
    // Check if the requested file exists
    if (!fs.existsSync(filePath)) {
        return res.sendFile(defaultPhotoPath);
    }

    res.sendFile(filePath);
};

exports.getDashboard = async (req, res) => {
    try {
        const queries = {
            admins: "SELECT COUNT(*) AS count FROM admin",
            customers: "SELECT COUNT(*) AS count FROM customers",
            medicines: "SELECT COUNT(*) AS count FROM medicines",
            suppliers: "SELECT COUNT(*) AS count FROM suppliers",
            feedback: "SELECT customer_name, customer_feedback, customer_photo FROM customers WHERE customer_feedback IS NOT NULL"
        };

        const faqs = [
            { question: "How to place an order?", answer: "You can order via our website or contact customer support." },
            { question: "What payment methods are available?", answer: "We accept credit cards, UPI, and net banking." },
            { question: "What should I do if I receive the wrong medication?", answer: "If you receive the wrong medication, please contact our support team immediately. You can initiate a return or exchange request through the pharmacy portal." },
            { question: "Are prescriptions required to purchase medication?", answer: "Yes, for certain medications, a valid prescription from a licensed healthcare provider is required." },
            { question: "Is my personal data secure?", answer: "Yes, your personal data is protected with strong encryption methods and follows industry best practices." }
        ];

        // Execute all queries in parallel
        const [admins, customers, medicines, suppliers, feedback] = await Promise.all([
            pool.query(queries.admins),
            pool.query(queries.customers),
            pool.query(queries.medicines),
            pool.query(queries.suppliers),
            pool.query(queries.feedback)
        ]);

        res.render("dashboard", {
            admins: admins[0][0].count,
            customers: customers[0][0].count,
            medicines: medicines[0][0].count,
            suppliers: suppliers[0][0].count,
            feedback: feedback[0],
            faqs,
            profile: req.session.user?.role,
            username: req.session.user?.username,
            pagetitle: 'Home',
        });
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).render('500', { 
            profile: req.session.user?.role,
            username: req.session.user?.username,
            pagetitle: 'Internal Server Error',
            error: err.message
        });
    }
};

exports.showMedicines = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Default to page 1
        const limit = 8; // Medicines per page
        const offset = (page - 1) * limit;

        const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM medicines');
        const [medicines] = await pool.query('SELECT * FROM medicines LIMIT ? OFFSET ?', [limit, offset]);

        res.render("medicinesDetails", {
            profile: req.session.user?.role,
            username: req.session.user?.username,
            pagetitle: "Medicines Details",
            medicines: medicines || [],
            currentPage: page,
            totalPages: Math.ceil(total / limit)
        });

    } catch (err) {
        console.error("Database Error:", err);
        return res.render("500", {
            profile: req.session.user?.role,
            username: req.session.user?.username,
            pagetitle: "Internal Server Error",
            error: err.message
        });
    }
};
