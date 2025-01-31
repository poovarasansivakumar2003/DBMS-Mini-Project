const express = require('express');
const router = express.Router();

router.get('/', (req, res, next) => {
    res.send('<h1>Welcome to the home page</h1>');
});

router.use((req,res,next)=>{
    res.status(404).send('<h1>Page not Found</h1>');
});

module.exports=router;
