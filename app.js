const express = require('express');
const path = require('path');
const pool = require('./db');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const rateLimit = require("express-rate-limit");
require('dotenv').config();

const app = express();
const server = http.createServer(app); // Attach server to Express
const io = socketIo(server); // Attach socket.io to the server

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Make io available globally
app.set('io', io);

// Sign and encrypt session data
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000 // 1 day expiry
    }
}));

// Middleware

// Rate limiting configuration
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per window
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply middleware
app.use(apiLimiter);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Set View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Use Routes
const routes = require('./routes/indexRoutes');
app.use(routes);

// Render Error Pages
function renderErrorPage(res, statusCode, template, pagetitle, session) {
    return res.status(statusCode).render(template, {
        profile: session?.user?.role,
        username: session?.user?.username,
        pagetitle
    });
}

// Handle 404 Not Found
app.use((req, res) => renderErrorPage(res, 404, "404", "Page Not Found", req.session || {}));

// Handle Other Errors
app.use((err, req, res, next) => {
    console.error(err.stack);
    const status = err.status || 500;
    const template = status === 400 ? "400" : "500";
    const pagetitle = status === 400 ? "Bad Request" : "Internal Server Error";
    
    return renderErrorPage(res, status, template, pagetitle, req.session || {});
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});

// Test MySQL Connection
pool.query('SELECT 1')
    .then(() => console.log('✅ MySQL Connection Successful'))
    .catch(err => console.error('❌ MySQL Connection Error:', err));

// Graceful shutdown handler
function gracefulShutdown(signal) {
    console.log(`Received ${signal}, shutting down gracefully...`);
    server.close(() => {
        console.log("Server closed.");
        process.exit(0);
    });
}

// Handle termination signals
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));