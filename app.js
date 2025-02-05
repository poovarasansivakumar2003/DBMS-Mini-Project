const express = require('express');
const path = require('path');
const cors = require("cors");
const pool = require("./db");
const session = require('express-session');
require('dotenv').config();

const app = express();

// sign and encrypt session data
app.use(session({
    secret: process.env.SESSION_SECRET, // Uses the secret key from .env
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
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
const adminRoutes = require('./routes/admin');  
const shopRoutes = require('./routes/shop');

// Use Routes
app.use('/admin', adminRoutes);
app.use(shopRoutes); 

// Handle 404 Errors
app.use((req, res) => {
    res.status(404).render('404', { pagetitle: 'Page Not Found', path: 'err' });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}).on('error', (err) => {
    console.error("Error starting server:", err);
});
