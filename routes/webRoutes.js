const express = require('express');
const router = express.Router();
const {handleMetaData, handleGetMetaData, handleGetApiData} = require('../controllers/webController');


// store data
router.post('/', handleMetaData);


// Display data for mobile
router.get('/data', handleGetMetaData);

//Get and Send Api Data 
router.get('/apiData/:pageId', handleGetApiData);

module.exports = router;