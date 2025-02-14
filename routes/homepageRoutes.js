const express = require("express");
const router = express.Router();

const homepageController = require("../controllers/homepageController");
const customerRegistrationController = require("../controllers/customerRegistrationController");
const authController = require('../controllers/authController');
const contactController = require('../controllers/contactController');

router.get("/", homepageController.getDashboard);
router.get('/login', authController.getLoginPage);
router.post('/login', authController.handleLogin);
router.get('/logout', authController.logout);
router.get("/customerRegister", customerRegistrationController.getCustomerRegister);
router.post("/customerRegister", customerRegistrationController.customerRegister);
router.get('/contact', contactController.getContactPage);
router.post('/contact', contactController.postContactForm);

module.exports = router;
