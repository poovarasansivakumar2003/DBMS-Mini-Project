const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/dashboard', adminController.showDashboard);
router.get('/medicines', adminController.showMedicines);
router.post('/add-medicine', adminController.addMedicine);
router.get('/delete-medicine/:id', adminController.deleteMedicine);

// Add routes for other features (customers, purchases, etc.)

module.exports = router;
