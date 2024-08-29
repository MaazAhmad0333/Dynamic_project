const express = require('express');
const router = express.Router();
const {handleMetaData, handleGetMetaData, handleGetFlows, handleFeedbackData} = require('../controllers/webController');


// Store Web Data
router.post('/', handleMetaData);


//Display list of flows
router.get('/flows', handleGetFlows);

// Display data for mobile
router.get('/data', handleGetMetaData);

// Store Mobile Data
router.post('/feedback', handleFeedbackData);


//Get and Send Api Data 
// router.get('/apiData/:orderid?', handleGetApiData);

module.exports = router;