const express = require("express");
const path = require("path");
const pool = require("../db");

// Serve static files
const app = express();
app.use("/private/uploads/customersPhotos", express.static(path.join(__dirname, "../private/uploads/customersPhotos")));

exports.getDashboard = async (req, res) => {
    try {
        const queries = {
            admins: "SELECT COUNT(*) AS count FROM admin",
            customers: "SELECT COUNT(*) AS count FROM customers",
            medicines: "SELECT COUNT(*) AS count FROM medicines",
            suppliers: "SELECT COUNT(*) AS count FROM suppliers",
            feedback: "SELECT customer_name, customer_feedback FROM customers WHERE customer_feedback IS NOT NULL LIMIT 5"
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
        console.error("Error fetching dashboard data:", err);
        res.status(500).render('500', { 
            profile: req.session.user?.role,
            username: req.session.user?.username,
            pagetitle: 'Internal Server Error',
            error: "Couldn't fetch from database. Try again later."
        });
    }
};

exports.showMedicines = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Default to page 1
        const limit = 4; // Medicines per page
        const offset = (page - 1) * limit;

        const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM medicines');

        const [medicines] = await pool.query('SELECT * FROM medicines LIMIT ? OFFSET ?', [limit, offset]);

        const totalPages = Math.ceil(total / limit);

        res.render("medicinesDetails", {
            profile: req.session.user?.role,
            username: req.session.user?.username,
            pagetitle: "Medicines Details",
            medicines: medicines || [],
            currentPage: page,
            totalPages
        });

    } catch (err) {
        console.error(err);
        return res.render("500", {
            profile: req.session.user?.role,
            username: req.session.user?.username,
            pagetitle: "Internal Server Error",
            error: 'Database error. Please try again. ' + err.message
        });
    }
};
