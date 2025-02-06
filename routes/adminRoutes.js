const express = require('express');
const adminController = require('../controllers/adminController');
const router = express.Router();

router.get('/adminDashboard', adminController.getAdminDashboard);
router.post('/admin/add-medicine', adminController.addMedicine);
router.delete('/admin/medicines/:id', adminController.deleteMedicine);

module.exports = router;