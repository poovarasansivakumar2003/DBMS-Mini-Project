const path = require("path");
const express = require("express");
const { executeDashboardQueries } = require("../dbHelpingQueries");  // Import the helper for queries

// Serve static files
const app = express();
app.use("/private/uploads/customersPhotos", express.static(path.join(__dirname, "../private/uploads/customersPhotos")));

// Handle Dashboard Rendering
exports.getDashboard = async (req, res) => {
    try {
        const data = await executeDashboardQueries();

        const faqs = [
            { question: "How to place an order?", answer: "You can order via our website or contact customer support." },
            { question: "What payment methods are available?", answer: "We accept credit cards, UPI, and net banking." },
            { question: "What should I do if I receive the wrong medication?", answer: "If you receive the wrong medication, please contact our support team immediately." },
            { question: "Are prescriptions required to purchase medication?", answer: "Yes, for certain medications, a valid prescription from a licensed healthcare provider is required." },
            { question: "Is my personal data secure?", answer: "Yes, your personal data is protected with strong encryption methods." }
        ];

        res.render("dashboard", {
            admins: data.getAdminCount[0].count || 0,
            customers: data.getCustomerCount[0].count || 0,
            medicines: data.getMedicineCount[0].count || 0,
            suppliers: data.getSupplierCount[0].count || 0,
            feedback: data.getFeedback || [],
            faqs,
            pagetitle: 'Home',
            profile: req.session.user?.role,
            username: req.session.user?.username
        });
    } catch (err) {
        console.error("Error fetching dashboard data:", err);
        res.status(500).render("500", {
            profile: req.session.user?.role,
            username: req.session.user?.username,
            pagetitle: 'Internal Server Error'
        });
    }
};