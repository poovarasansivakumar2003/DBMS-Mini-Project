const express = require('express');
const router = express.Router();

const homepageRoutes = require('./homepageRoutes');
const customerRoutes = require('./customerRoutes');
const adminRoutes = require('./adminRoutes');

router.use(homepageRoutes);
router.use('/customer', customerRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
