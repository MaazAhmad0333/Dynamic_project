const express = require('express');
const {db} = require('../connection');
const axios = require('axios');
const uuid = require('uuid');
const dbprovider = require('../providers/dbProvider');
const {validateMetaData, validateFeedbackData, validateDataResult, validateVariableResult} = require('../validators/validation');

// Storing all Meta Data
async function handleMetaData(req, res){

  //validation function
    const validationError = validateMetaData(req);
    if (validationError) {
      return res.status(validationError.status).json({ msg: validationError.msg });
    }

    const flowName = req.body.flow_name;
    const variable = req.body.variable;
    const pagesArray = req.body.pages;
    
    try{
      const flowResult = await dbprovider.saveFlowData(flowName);
      flowId = flowResult.insertId;

       // Inserting new variables data into flowvariable table
      await dbprovider.saveVariableData(variable, flowId);
 
      // Creating data on newly created flow
      let promises = [];
      for(let page of pagesArray) {
          const {step_type, meta_data, order_id} = page;
          promises.push(dbprovider.savePagesData(step_type, meta_data, order_id, flowId));
      }

      await Promise.all(promises);
      return res.status(200).json({ message: 'Data saved successfully!'});

    }catch(error){
      console.log("🚀 ~ handleMetaData ~ error:", error)
      return res.status(200).json({ message: '! Data not Saved '});
    }
}




// Sending List of Flows
async function handleGetFlows(req, res){
    try{
      const flows = await dbprovider.extractingFlows();
      return res.json(flows);
    }
    catch(error){
      console.log("🚀 ~ handleGetFlows ~ error:", error)
      return res.status(200).json({ message: '! Flows not found '});
    }
}










// Just Testing the post api request is working 
async function handlepost(req, res){
    const x = req.body;
    console.log("🚀 ~ handlepost ~ x:", x);
    return res.json({msg: "hello"});    
}









// Sending single record/row form the database to Mobile
async function handleGetMetaData(req, res){
    let token = null;

    // ==============================Validating flow_id query parameter======================================= //
    if (!req.query.flow_id) {
        return res.status(400).json({ error: "flow_id is required" });
    }

    let whereClause = "(SELECT MIN(order_id) FROM pages WHERE flow_id = ? AND step_type != 'api' AND order_id != 0)";
    let queryValues = [];

    if(req.headers.x_page_token){
        let bufferObj = Buffer.from(req.headers.x_page_token, "base64");
        let token = bufferObj.toString("utf8");
        token = JSON.parse(token)

        // =========================================Checking token structure============================ //
        if (!token.next_order_id) {
            return res.status(400).json({ error: "Invalid token format: next_order_id is missing" });
        }

        whereClause = "?";
        queryValues.push(token.next_order_id); 
    }

    queryValues.push(req.query.flow_id);
    queryValues.push(req.query.flow_id);

    let data = await dbprovider.getPageData(whereClause, queryValues);
    

    const validationError = validateDataResult(data);
    if (validationError) {
        return res.status(validationError.status).json({ error: validationError.msg });
    }

    data = data[0];
    
    token = null;

    let orderInfo = await dbprovider.getNextPage( [data.order_id+1, req.query.flow_id]);


    if(orderInfo) {
        token = {next_order_id: orderInfo.order_id };
        buffer = Buffer.from(JSON.stringify(token), 'utf-8');
        token = buffer.toString('base64');    
    }

    let apidetails = await dbprovider.getApiDetails(data.flow_id);
    
    if(data.meta_data){
        for(const item of data.meta_data){
            let xyz = null;
            let varMatch = [];
            if(item.inputs){

                for(let input of item.inputs){
                    
                    for(let key in input){    
                      const value = input[key];
                      if(Array.isArray(value)){
                            value.forEach((val,index) =>{
                                if(typeof val === 'string' && val.includes('{{') && val.includes('}}')){
                                    let abc = { word: key, value: val };
                                    xyz = abc.word;
                                    varMatch.push((abc.value).replace(/\{\{(.*?)\}\}/, '$1').trim());
                                }
                            })
                      }
                        
                    }


                    if(xyz && input.hasOwnProperty(xyz)){
                        console.log("coming here")
                        for(let apiObj of apidetails){
                            if(varMatch.some(element => element === apiObj.meta_data[0].details.Success.Response.Variable)){
                                httpType = apiObj.meta_data[0].details.Type;
                                    if(httpType === "get" || httpType === "Get"){
                                        await handleGetRequest(data, apiObj, db, null, xyz, input)
                                    }
                                    else if(httpType === "post" || httpType === "Post"){
                                      await handlePostRequest(data, apiObj, db)   
                                    }
                            }       
                        }
                    }
                }
            }else{
                console.log("hello world")
                for(let key in item){
                  const value = item[key];
                  if(Array.isArray(value)){
                        value.forEach((val,index) =>{
                            if(typeof val === 'string' && val.includes('{{') && val.includes('}}')){
                                let abc = { word: key, value: val };
                                xyz = abc.word;
                                varMatch.push((abc.value).replace(/\{\{(.*?)\}\}/, '$1').trim());
                                console.log("🚀 ~ value.forEach ~ varMatch:", varMatch)
                            }
                        })
                  }
   
                }
                if(xyz && item.hasOwnProperty(xyz)){
                    for(let apiObj of apidetails){
                        if(varMatch.some(element => element === apiObj.meta_data[0].details.Success.Response.Variable)){
                            httpType = apiObj.meta_data[0].details.Type;
                            if(httpType === "get" || httpType === "Get"){
                                await handleGetRequest(data, apiObj, db, item, xyz, null)
                            }
                            else if(httpType === "post" || httpType === "Post"){
                              await handlePostRequest(data, apiObj, db)      
                            } 
                        }
                    }
                }
            }

            // ================================Extracting variables value in Summary ===================================== //
            let searching = await dbprovider.getFlowVariables(data.flow_id);
            // searching = searching[0];
            
            const validationError = validateVariableResult(searching);
            if (validationError) {
                return res.status(validationError.status).json({ error: validationError.msg });
            }
            
            let {request_id} = req.headers;
            const variables = searching.variable;
            let mobileData = await dbprovider.getMobileData(data.flow_id, request_id);
            let mobileDatas ={}
            for(let objdata of mobileData){
                for(let key in objdata.result) {
                    mobileDatas[key] = objdata.result[key]
                }
            }
            for (let item1 of variables) {
                if (varMatch.some(element => element === item1.key)) {
                    if(mobileDatas){
                        console.log("-----------------")
                        let reqVariables = mobileDatas[item1.key];
                        // console.log("🚀 ~ item1.key:", item1.key)
                        const keyValuePair = {
                            [item1.key]: reqVariables || null
                        };
                        
                        if (!Array.isArray(item.fields)) {
                            item.fields = [];
                        }
                        
                        item.fields = item.fields.filter(field => {
                            return typeof field === 'object' && !Array.isArray(field) && Object.keys(field).length === 1;
                        })
                        item.fields.push(keyValuePair);
                    }
                    else{
                        return res.json({msg: "There is no data coming in the mobiledata check query"})
                    }                           
                }
            }    
        }
    }

        
    if(data.order_id === 1){
        var request_id = uuid.v4(); 
        return res.json({data, token, request_id});
     }else{
        return res.json({data, token});
     }  
}








async function handleFeedbackData(req,res){
    try{
      //validation function
      const validationError = validateFeedbackData(req);
      if (validationError) {
        return res.status(validationError.status).json({ msg: validationError.msg });
      }
      
      const request_id = req.headers.request_id;
      const {page_id, result} = req.body;

      const existingData = await dbprovider.extractingFeedback(page_id, request_id);

      if(existingData.length > 0){
          await dbprovider.updateFeedbacks(result, page_id, request_id);
          return res.json({msg: "Feedback updated successfully"})
      }else{
        const dataArray = await dbprovider.createFeedback(result, page_id, request_id);
        return res.json({ msg: "Page saved Successfully", id: dataArray.insertId });
      }
    }
    catch(error){
      console.log("🚀 ~ handleFeedbackData ~ error:", error)
      return res.json({ msg: "! Feedback not saved"});
    }   
}








async function handleGetRequest(data, apiObj, db, item, xyz, input) {
  const flowid = data.flow_id;

        const apiUrls = apiObj.meta_data[0].details.Url;

        // Check if apiUrls is an array
        if (Array.isArray(apiUrls)) {
            return { msg: "Url key has multiple values only single is required" };
        }
        let apiResponse;
        let params = '';
        let firstParam = true;

        // Loop through the parameters defined in apiObj
        for (let fld in apiObj.meta_data[0].details.Param) {
            if (firstParam) {
                firstParam = false;
                params += '?';
            } else {
                params += '&';
            }

            let paramsUrl = [];
            let searching = await dbprovider.getVariables(flowid);
            
            if (!searching) {
                console.log("No Variables data found");
                continue;
            }

            const variables = searching.variable;
            for (let item of variables) {
                if (item.key === apiObj.meta_data[0].details.Param[fld]) {
                    let mobileData = await dbprovider.getApiMobileData(flowid);
                    const mobileDatas = mobileData[0];

                    let reqVariables = mobileDatas.result[item.key];
                    paramsUrl.push(reqVariables);
                }
            }

            // Append parameters to URL
            params += fld + '=' + paramsUrl;
        }

        // Build the complete API URL
        let API_URL = apiUrls + params;
        console.log("🚀 ~ handleGetRequest ~ API_URL:", API_URL);

        // Make the GET request
        const response = await axios.get(API_URL);
        apiResponse = response.data;

        let extractedData;
        if ((apiObj.meta_data[0].details.Success.Response.field).length > 0) {
            extractedData = apiResponse.map(data => {
                let extData = {};

                for (let fld of apiObj.meta_data[0].details.Success.Response.field) {
                    extData[fld] = data[fld];
                }
                return extData;
            });
        } else {
            extractedData = null;
        }

        // Assign extracted data to the specified item
        if(input){
          input[xyz] = extractedData;  
        }else{
          
          item[xyz] = extractedData; 
        }
        
}


async function handlePostRequest(data, apiObj, db) {
  const flowid = data.flow_id;
        const apiUrls = apiObj.meta_data[0].details.Url;

        console.log("🚀 ~ handlePostRequest ~ apiUrls:", apiUrls);

        // Check if apiUrls is an array
        if (Array.isArray(apiUrls)) {
            return { msg: "Url key has multiple values only single is required" };
        }

        let body = apiObj.meta_data[0].details.Body;
        const entries = Object.entries(body); // Extract key-value pairs from the body
        let reqVariablesdata = [];

        // Loop through each entry in the body
        for (let objectentries of entries) {
            const value = objectentries[1]; // Get the value from body
            const match = value.replace(/\{\{(.*?)\}\}/, '$1').trim(); // Extract the variable inside {{ }}

            // Query flow variables from the database
            let searching = await dbprovider.getVariables(flowid);
            // searching = searching[0];

            if (!searching) {
                console.log("No Variables found");
                continue;
            }

            const variables = searching.variable;

            // Loop through the variables to find a match
            for (let item of variables) {
                if (item.key === match) {
                    // Fetch data from the feedbacks and pages table
                    let mobileData = await dbprovider.getApiMobileData(flowid);
                    const mobileDatas = mobileData[0];

                    if (mobileDatas) {
                        // Extract the required variable and push it to the request data
                        let reqVariables = mobileDatas.result[item.key];
                        console.log("🚀 ~ reqVariables:", reqVariables);
                        reqVariablesdata.push(reqVariables);
                    }
                }
            }
        }

        // Make the POST request
        const response = await axios.post(apiUrls, reqVariablesdata);
        console.log("🚀 ~ handlePostRequest ~ response.status:", response.status);
        return response.status; // Return the status for further use if necessary
}












module.exports = {handleMetaData, handleGetMetaData, handleGetFlows, handleFeedbackData, handlepost};