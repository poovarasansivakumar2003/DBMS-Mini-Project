const express = require('express');
const path = require('path');
const router = express.Router();

router.get('/', (req, res, next) => {
    res.render('index',{pagetitle:'Home', path:'/'});
});

module.exports=router;
