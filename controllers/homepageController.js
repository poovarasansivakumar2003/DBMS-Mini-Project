const pool = require("../db");
const bcrypt = require('bcryptjs');

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
            { question: "Are prescriptions required to purchase medication?", answer: "Yes, for certain medications, a valid prescription from a licensed healthcare provider is required. Our system will guide you through the necessary steps to upload your prescription when placing an order." },
            { question: "Is my personal data secure on the Pharmacy Management System?", answer: "Yes, your personal data is protected with strong encryption methods and follows industry best practices for data security. We are committed to safeguarding your privacy." }
        ];

        // Execute all queries in parallel using Promise.all
        const [admins, customers, medicines, suppliers, feedback] = await Promise.all([
            pool.query(queries.admins),
            pool.query(queries.customers),
            pool.query(queries.medicines),
            pool.query(queries.suppliers),
            pool.query(queries.feedback)
        ]);

        const profile = req.session.user ? req.session.user.role : undefined;

        res.render("home", {
            admins: admins[0][0].count,
            customers: customers[0][0].count,
            medicines: medicines[0][0].count,
            suppliers: suppliers[0][0].count,
            feedback: feedback[0],
            faqs,
            profile,
            pagetitle: 'Home',
            username: req.session.user ? req.session.user.username : null
        });

    } catch (err) {
        console.error("Error fetching dashboard data:", err);
        res.status(500).send("Internal Server Error");
    }
};

exports.getCustomerRegister = (req, res) => {
    const profile = req.session.user ? req.session.user.role : undefined;
    res.render('customerRegister', {
        profile, 
        pagetitle: 'Customer Register', 
        username: req.session.user ? req.session.user.username : null
    });
};

exports.customerRegister = async (req, res) => {
    const { customer_name, customer_email, customer_ph_no, customer_password, customer_address } = req.body;

    // Check if customer_password is undefined or missing
    if (!customer_password) {
        return res.status(400).send('Password is required');
    }

    // Trim the password to remove leading or trailing spaces
    const trimmedPassword = customer_password.trim();
    console.log('Trimmed Password:', trimmedPassword);

    // Hash the trimmed password before storing it in the database
    bcrypt.hash(trimmedPassword, 10, (err, hashedPassword) => {
        if (err) {
            console.error('Error hashing password:', err);
            return res.status(500).send('Error hashing password');
        }

        // Insert customer data into the database
        const query = 'INSERT INTO customers (customer_name, customer_email, customer_ph_no, customer_password, customer_address) VALUES (?, ?, ?, ?, ?)';
        pool.query(query, [customer_name, customer_email, customer_ph_no, hashedPassword, customer_address], (err, result) => {
            if (err) {
                console.error('Error inserting into database:', err);
                return res.status(500).send('Error registering the customer');
            }
            res.send('Customer registered successfully!');
        });
    });

    const profile = req.session.user ? req.session.user.role : undefined;

    res.render("customerRegister", {
        profile, pagetitle: 'Customer Register', username: req.session.user ? req.session.user.username : null
    });
};