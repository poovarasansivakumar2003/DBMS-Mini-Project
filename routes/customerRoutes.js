const express = require('express');
const customerController = require('../controllers/customerController');
const router = express.Router();

router.get('/customerDashboard', customerController.getCustomerDashboard);

module.exports = router;