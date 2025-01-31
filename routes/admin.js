const express = require('express');
const path = require('path');
const router = express.Router();


router.get('/add-product', (req, res, next) => {
    res.send(`
        <h1>Add Product</h1>
        <form action="/admin/product" method="POST">
            <input type="text" name="title" placeholder="Product Title">
            <button type="submit">Submit</button>
        </form>
    `);
});

router.post('/product', (req, res, next) => {
    const title = req.body.title;
    console.log(`Product added: ${title}`);
    res.redirect('/');
});

router.get('/add-product', (req, res, next) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'add-product.html'));
});
router.post('/product', (req, res, next) => {
    const title = req.body.title;
    console.log(`Product added: ${title}`);
    res.redirect('/');
});

module.exports=router;
