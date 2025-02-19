const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/adminDashboard', adminController.showDashboard);
router.get('/adminDashboard', adminController.showMedicines);
router.post('/adminDashboard', adminController.addMedicine);
router.get('/adminDashboard', adminController.deleteMedicine);
router.get('/adminDashboard', adminController.showCustomers);

module.exports = router;
