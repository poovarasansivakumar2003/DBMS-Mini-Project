const express = require("express");
const router = express.Router();
const homepageController = require("../controllers/homepageController");

// Homepage & Dashboard
router.get("/", homepageController.getDashboard);
router.get("/customerRegister", homepageController.getCustomerRegister);
router.post("/customerRegister", homepageController.customerRegister);

module.exports = router;
