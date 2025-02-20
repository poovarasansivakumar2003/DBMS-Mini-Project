const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/adminDashboard', adminController.getAdminDashboard);
router.get('/medicinesDetails', adminController.showMedicines);
router.post('/adminDashboard', adminController.addMedicine);
router.post('/adminDashboard', adminController.editMedicine);
router.get('/adminDashboard', adminController.deleteMedicine);
router.get('/customer', adminController.showCustomers);

module.exports = router;
