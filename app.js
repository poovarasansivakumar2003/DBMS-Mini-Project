const express = require('express');
const fs = require("fs");
const path = require('path');
const cors = require("cors");
const session = require('express-session');
require('dotenv').config();

const app = express();

// sign and encrypt session data
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV,
        httpOnly: true, 
        maxAge: 24 * 60 * 60 * 1000 
    }
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Set View Engine
app.set('view engine', 'ejs');
app.set('views', 'views');

// Import Routes
const homepageRoutes = require('./routes/homepageRoutes');
const adminRoutes = require('./routes/adminRoutes');
const customerRoutes = require('./routes/customerRoutes');

// Use Routes
app.use(homepageRoutes);
app.use('/customer', customerRoutes);
app.use('/admin', adminRoutes);

app.use((err, req, res, next) => {
    console.error(err.stack);

    if (err.status === 400) {
        return res.status(400).render("400", {
            profile: req.session.user?.role,
            username: req.session.user?.username,
            pagetitle: "Bad Request"
        });
    }

    if (err.status === 404) {
        return res.status(404).render("404", {
            profile: req.session.user?.role,
            username: req.session.user?.username, 
            pagetitle: 'Page Not Found'
        });
    }

    return res.status(500).render("500", {
        profile: req.session.user?.role,
        username: req.session.user?.username,
        pagetitle: "Internal Server Error"
    });
});


// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}).on('error', (err) => {
    console.error("Error starting server:", err);
});
