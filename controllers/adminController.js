const db = require('../db'); 
const multer = require('multer');
const path = require('path');

exports.showDashboard = (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }
    res.render('adminDashboard', { 
        pagetitle: `Admin Panel - ${req.session.user.username}`, 
        username: req.session.user.username,
        profile: "admin"
    });
};



// Define storage for uploading images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/img/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// View medicines
exports.showMedicines = (req, res) => {
    db.query('SELECT * FROM medicines', (err, result) => {
        if (err) throw err;
        res.render('adminDashboard', { medicines: result });
    });
};

// Add new medicine
exports.addMedicine = upload.single('medicine_img_url'), (req, res) => {
    const { medicine_name, medicine_composition, medicine_price, medicine_expiry_date } = req.body;
    const imgUrl = req.file.path;

    const query = `INSERT INTO medicines (medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_img_url) 
                   VALUES (?, ?, ?, ?, ?)`;

    db.query(query, [medicine_name, medicine_composition, medicine_price, medicine_expiry_date, imgUrl], (err, result) => {
        if (err) throw err;
        res.redirect('/admin/medicines');
    });
};

// Delete medicine
exports.deleteMedicine = (req, res) => {
    const { id } = req.params;
    const query = `DELETE FROM medicines WHERE medicine_id = ?`;
    db.query(query, [id], (err, result) => {
        if (err) throw err;
        res.redirect('/admin/medicines');
    });
};

