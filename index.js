const express = require('express');
const app = express();
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));

const adminRoles = require('./routes/admin');
const shop = require('./routes/shop');
app.use('/admin', adminRoles);
app.use(shop);


app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
