const express = require("express");
const path = require("path");
const pool = require("../db");

// Serve static files
const app = express();
app.use("/private/uploads/customersPhotos", express.static(path.join(__dirname, "../private/uploads/customersPhotos")));

exports.getDashboard = async (req, res) => {
    const profile = req.session.user ? req.session.user.role : undefined;
    const username = req.session.user ? req.session.user.username : null;
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
            profile,
            username,
            pagetitle: 'Home',
        });
    } catch (err) {
        console.error("Error fetching dashboard data:", err);
        res.status(500).render('500', { 
            profile, 
            username,
            pagetitle: 'Internal Server Error',
            error: "Couldn't fetch from database. Try again later."
        });
    }
};