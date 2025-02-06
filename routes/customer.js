const express = require('express');
const customerController = require('../controllers/customerController');
const router = express.Router();

router.get('/customerDashboard', customerController.getCustomerDashboard);
router.get('/medicines', customerController.getMedicines);

module.exports = router;