const express = require('express');
const router = express.Router();
const {handleMetaData, handleGetMetaData, handleGetFlows, handleFeedbackData, handleGetMobileData, handlepost} = require('../controllers/webController');


// Store Web Data
router.post('/', handleMetaData);


//Display list of flows
router.get('/flows', handleGetFlows);

// Just for checking that data is comming
router.post('/flows', handlepost); 

// Display data for mobile
router.get('/data', handleGetMetaData);

// Store Mobile Data
router.post('/feedback', handleFeedbackData);

// Get stored feedback data
router.get('/getfeedback', handleGetMobileData);



//Get and Send Api Data 
// router.get('/apiData/:orderid?', handleGetApiData);

module.exports = router;