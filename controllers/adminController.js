const pool = require("../db");

exports.getAdminDashboard = (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }
    res.render('adminDashboard', { 
        pagetitle: `Admin Panel - ${req.session.user.username}`, 
        username: req.session.user.username,
        profile: "admin"
    });
};

exports.addMedicine = async (req, res) => {
    try {
        const { medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_img_url } = req.body;
        const [result] = await pool.query(
            "INSERT INTO medicines (medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_img_url) VALUES (?, ?, ?, ?, ?)",
            [medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_img_url]
        );
        res.status(201).json({ message: "Medicine added successfully", medicine_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteMedicine = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query("DELETE FROM medicines WHERE medicine_id = ?", [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Medicine not found" });
        }
        res.json({ message: "Medicine deleted successfully!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
