const express = require('express');
const path = require('path');
const router = express.Router();

router.get('/login', (req, res, next) => {
    res.render('login',{pagetitle:'Login', path:'login'});
});

module.exports = router;
