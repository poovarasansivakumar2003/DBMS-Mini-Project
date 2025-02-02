const express = require('express');
const path = require('path');
const pool = require("../db");
const router = express.Router();

router.get('/', (req, res, next) => {
    res.render('index',{pagetitle:'Home', path:'/'});
});

// Route to get all medicines and render the page
router.get("/medicines", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM medicines");
        res.render("medicines", { pagetitle: "Medicines", path: "/medicines", medicines: rows });
    } catch (err) {
        res.status(500).send(err.message);
    }
});


module.exports=router;
