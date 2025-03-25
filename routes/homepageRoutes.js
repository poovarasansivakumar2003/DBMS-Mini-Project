const express = require("express");
const router = express.Router();

const homepageController = require("../controllers/homepageController");
const authController = require('../controllers/authController');
const contactController = require('../controllers/contactController');
const customerRegistrationController = require("../controllers/customerRegistrationController");

router.get("/", homepageController.getDashboard);
router.get("/medicinesDetails", homepageController.showMedicines);

router.get('/login', authController.getLoginPage);
router.post('/login', authController.handleLogin);
router.get('/logout', authController.logout);

router.get('/forgotPassword', authController.forgotPassword);  
router.post('/forgotPassword', authController.forgotPassword); 
router.get('/otpVerification', authController.verifyOtp); 
router.post('/otpVerification', authController.verifyOtp);  
router.get('/resetPassword', authController.resetPassword);  
router.post('/resetPassword', authController.resetPassword);

router.get('/contact', contactController.getContactPage);
router.post('/contact', contactController.postContactForm);

router.get("/customerRegister", customerRegistrationController.getCustomerRegister);
router.post("/customerRegister", customerRegistrationController.customerRegister);
router.get("/customer/downloadCard/:filename", customerRegistrationController.downloadCustomerCard);


module.exports = router;
