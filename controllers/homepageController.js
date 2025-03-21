const path = require("path");
const pool = require("../db");
const fs = require('fs');

exports.getDashboard = async (req, res) => {
    try {
        const queries = {
            admins: "SELECT COUNT(*) AS count FROM admin",
            customers: "SELECT COUNT(*) AS count FROM customers",
            feedbacks: "SELECT COUNT(*) AS count FROM feedbacks",
            medicines: "SELECT COUNT(*) AS count FROM medicines",
            suppliers: "SELECT COUNT(*) AS count FROM suppliers",
            stocks: "SELECT COUNT(*) AS count FROM stocks",
            purchases: "SELECT COUNT(*) AS count FROM purchase_sessions",
            payments: "SELECT COUNT(*) AS count FROM payments",
            invoice: "SELECT COUNT(*) AS count FROM invoice",
            getfeedback: "SELECT c.customer_name, f.feedback_text, c.customer_photo, f.rating FROM feedbacks f JOIN customers c ON f.customer_id = c.customer_id WHERE f.rating >= 3 ORDER BY f.rating DESC LIMIT 4 ",
            topSellingMedicinesQuery: "SELECT m.medicine_id, m.medicine_name AS name, m.medicine_type AS category, m.medicine_price AS price, m.medicine_img AS photo, COALESCE(SUM(p.purchased_quantity), 0) AS sold_count FROM medicines m LEFT JOIN purchases p ON m.medicine_id = p.medicine_id GROUP BY m.medicine_id ORDER BY sold_count DESC LIMIT 6 ",
            customerGrowthQuery: "WITH RECURSIVE date_series AS (SELECT CURDATE() - INTERVAL 29 DAY AS day UNION ALL SELECT day + INTERVAL 1 DAY FROM date_series WHERE day < CURDATE()) SELECT ds.day, COALESCE(COUNT(c.customer_id), 0) AS new_customers FROM date_series ds LEFT JOIN customers c ON DATE(c.customer_created_at) = ds.day GROUP BY ds.day ORDER BY ds.day ASC ",
            newCustomersQuery: "SELECT COUNT(*) AS newCustomers FROM customers WHERE MONTH(customer_created_at) = MONTH(CURRENT_DATE()) AND YEAR(customer_created_at) = YEAR(CURRENT_DATE())"
        };

        const faqs = [
            { question: "How to place an order?", answer: "You can order via our website or contact customer support." },
            { question: "What payment methods are available?", answer: "We accept credit cards, UPI, and net banking." },
            { question: "What should I do if I receive the wrong medication?", answer: "If you receive the wrong medication, please contact our support team immediately. You can initiate a return or exchange request through the pharmacy portal." },
            { question: "Are prescriptions required to purchase medication?", answer: "Yes, for certain medications, a valid prescription from a licensed healthcare provider is required." },
            { question: "Is my personal data secure?", answer: "Yes, your personal data is protected with strong encryption methods and follows industry best practices." }
        ];

        // Execute all queries in parallel
        const [admins, customers, feedbacks, medicines, suppliers, purchases, payments, invoice, stocks, getfeedback, topSelling, customerGrowth, newCustomers] = await Promise.all([
            pool.query(queries.admins),
            pool.query(queries.customers),
            pool.query(queries.feedbacks),
            pool.query(queries.medicines),
            pool.query(queries.suppliers),
            pool.query(queries.purchases),
            pool.query(queries.payments),
            pool.query(queries.invoice),
            pool.query(queries.stocks),
            pool.query(queries.getfeedback),
            pool.query(queries.topSellingMedicinesQuery),
            pool.query(queries.customerGrowthQuery),
            pool.query(queries.newCustomersQuery)
        ]);

        const customerGrowthData = customerGrowth[0] || [];
        const days = customerGrowthData.map(row => new Date(row.day).toISOString().split('T')[0]);
        const customerData = customerGrowthData.map(row => row.new_customers || 0);

        const feedbackWithImages = getfeedback[0].map(fb => ({
            customer_name: fb.customer_name,
            feedback_text: fb.feedback_text,
            rating: fb.rating,
            customer_photo: fb.customer_photo
                ? `data:image/jpeg;base64,${fb.customer_photo.toString('base64')}`
                : '/img/defaultPhoto.jpg'
        }));

        res.render("dashboard", {
            admins: admins[0][0].count,
            customers: customers[0][0].count,
            feedbacks: feedbacks[0][0].count,
            medicines: medicines[0][0].count,
            suppliers: suppliers[0][0].count,
            purchases: purchases[0][0].count,
            payments: payments[0][0].count,
            invoice: invoice[0][0].count,
            stocks: stocks[0][0].count,
            getfeedbacks: feedbackWithImages,
            topSelling: topSelling[0] || [],
            newCustomers: newCustomers[0][0]?.newCustomers || 0,
            customerGrowth: customerGrowthData,
            days,
            customerData,
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
        const [medicines] = await pool.query(`
            SELECT * FROM medicines 
            ORDER BY medicine_expiry_date ASC
            LIMIT ? OFFSET ?`, [limit, offset]);

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
