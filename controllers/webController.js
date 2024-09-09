const express = require('express');
const {db} = require('../connection');
const axios = require('axios');
const uuid = require('uuid');

// Storing all Meta Data
async function handleMetaData(req, res){
    //validation 
    let flowName = req.body.flow_name;
    if(!flowName){
        return res.status(400).json({msg: "Flow name is required"});
    }
    const pagesArray   = req.body.pages;
    if(!pagesArray){
        return res.status(400).json({msg: "Pages field is required"});
    }
    // Inserting new flow
    let [flowId] = await db.query('INSERT INTO flows (flow_name) VALUES (?)', [flowName]);
    flowId = flowId.insertId;

    // Creating data on newly created flow
    let promises = [];
    for(let page of pagesArray) {
        const {step_type, meta_data, order_id} = page;
        promises.push(db.query('INSERT INTO pages (step_type, meta_data, order_id, flow_id) VALUES (?, ?, ?, ?)', [step_type, JSON.stringify(meta_data), order_id, flowId]));
    }
    const insertIds = await Promise.all(promises);
    return res.status(200).json({ message: 'Data saved successfully!'});
}

// Sending single record/row form the database 
async function handleGetFlows(req, res){
    const [flows] = await db.query('SELECT * FROM flows');
    return res.json(flows);
    
}

// Just checking the post request is working 
async function handlepost(req, res){
    const x = req.body;
    console.log("🚀 ~ handlepost ~ x:", x);
    return res.json({msg: "hello"});
    
    
}

// Sending single record/row form the database 
async function handleGetMetaData(req, res){
    let token = null;
    // console.log("🚀 ~ handleGetMetaData ~ req:", req.headers)

    // Validating flow_id query parameter
    if (!req.query.flow_id) {
        return res.status(400).json({ error: "flow_id is required" });
    }

    let whereClause = "(SELECT MIN(order_id) FROM pages WHERE flow_id = ?)";
    let queryValues = [];
    // console.log(req.headers.x_page_token)
    if(req.headers.x_page_token){

        let bufferObj = Buffer.from(req.headers.x_page_token, "base64");
        // console.log("🚀 ~ handleGetMetaData ~ req.headers.x_page_token,:", req.headers.x_page_token)
        let token = bufferObj.toString("utf8");
        token = JSON.parse(token)

        // Validate token structure
        if (!token.next_order_id) {
            return res.status(400).json({ error: "Invalid token format: next_order_id is missing" });
        }
        
        // console.log("🚀 ~ handleGetMetaData ~ bufferObj:", bufferObj)
        // console.log("🚀 ~ handleGetMetaData ~ token:", token)
        whereClause = "?";
        queryValues.push(token.next_order_id); 
    }

    queryValues.push(req.query.flow_id);
    queryValues.push(req.query.flow_id);
    let query = `SELECT * FROM pages WHERE order_id = ${whereClause} AND flow_id = ? LIMIT 1`;
    // console.log("🚀 ~ handleGetMetaData ~ queryValues:", queryValues)
    // console.log("🚀 ~ handleGetMetaData ~ query:", query);
    let [data] = await db.query(query, queryValues);
    // console.log("🚀 ~ handleGetMetaData ~ [data]:", [data])
    if(!data.length){
        return res.status(404).json({ error: "No pages found for the given flow_id" });
    }
    data = data[0];
    // console.log("🚀 ~ handleGetMetaData ~ data:", data);
    
    //verify if next page exists
    token = null;
    query = `SELECT order_id FROM pages WHERE order_id = ? AND flow_id = ? LIMIT 1`;
    // console.log("🚀 ~ handleGetMetaData ~ query:", query)
    let [orderInfo] = await db.query(query, [data.order_id+1, req.query.flow_id]);

    orderInfo = orderInfo[0];
    if(orderInfo) {
        token = {next_order_id: orderInfo.order_id};
        // console.log("🚀 ~ handleGetMetaData ~ token:", token)
        buffer = Buffer.from(JSON.stringify(token), 'utf-8');
        // console.log("🚀 ~ handleGetMetaData ~ buffer:", buffer)
        token = buffer.toString('base64');
        // console.log("🚀 ~ handleGetMetaData ~ token:", token)    
    }
    
    if (data.meta_data) {
        for (const item of data.meta_data){
            if(item.api){
                // console.log("item spi", item.api)
                httpType = item.api.Type;
                console.log("🚀 ~ handleGetMetaData ~ httpType:", httpType)
                if(httpType === "get" || httpType === "Get"){
                    const apiUrls = item.api.Url
                    if(Array.isArray(apiUrls)){
                        return res.json({msg: "Url key has multiple values only single is required"});
                    }
                    let apiResponse;
                    
                    let params = '';
                    let firstParam = true;
                    for(let fld in item.api.Success.Request){
                        if(firstParam) {
                            firstParam = false;
                            params += '?';
                        }
                        else {
                            params += '&';
                        }
                        params += fld + '=' + item.api.Success.Request[fld];
                    }
                    let API_URL = apiUrls+params;
                    console.log("🚀 ~ handleGetMetaData ~ API_URL:", API_URL)
                    const response = await axios.get(API_URL);
                    apiResponse = response.data;
                    // console.log("apiResponse", apiResponse)
                    const extractedData = apiResponse.map(data=>{
                        let extData = {}
                        for(let fld of item.api.Success.Response.field){
                            extData[fld] = data[fld]
                        }
                        return extData;
                    })
                    // console.log("🚀 ~ extractedData ~ extractedData:", extractedData);
                    delete item.api;
                    // item.api.Success.Response.data = extractedData;
                    item.data = extractedData;
                    
                }else if(httpType === "post" || httpType === "Post"){
                    const flowid = data.flow_id;
                    // console.log("🚀 ~ handleGetMetaData ~ flowid:", flowid)
                    const apiUrls = item.api.Url
                    // console.log("🚀 ~ handleGetMetaData ~ apiUrls:", apiUrls)
                    if(Array.isArray(apiUrls)){
                        return res.json({msg: "Url key has multiple values only single is required"});
                    }
                    let body = item.api.Body;
                    
                    // Making the code dynamic
                    const entries = Object.entries(body);
                    let storedData = [];
                    for(let objectentries of entries){
                        const value = objectentries[1];
                        // console.log("🚀 ~ handleGetMetaData ~ value:", value) output: page1.feedback.id
                        const fieldReq = objectentries[0];
                        // console.log("🚀 ~ handleGetMetaData ~ fieldReq:", fieldReq) output: "id":
                        const firstPart = value.split('.')[0];
                        const number = firstPart.replace(/\D/g, '');
                        const newid = data.flow_id;
                        const abc = await db.query(`Select feedbacks.* From feedbacks JOIN pages ON feedbacks.page_id = pages.id WHERE pages.order_id = ${number} AND pages.flow_id = ${newid} ;`);
                        abcData = abc[0];
                        if(abcData.length > 0){
                            storedData.push(...abcData);    
                        }
                        // storedData = abc[0];
                    }

                    let requestBody = {
                        PagesData: storedData 
                    };

                    const response = await axios.post(apiUrls, storedData);
                    item.api.Success.Response.newStatus = response.status;
                    // const firstEntry = Object.entries(body)[0];
                    // var fx, fy; 
                    // if(firstEntry){
                    //     const value = firstEntry[1];
                    //     const fieldReq = firstEntry[0];
                    //     // console.log("🚀 ~ handleGetMetaData ~ fieldReq:", fieldReq)
                    //     // console.log("🚀 ~ handleGetMetaData ~ value:", value)
                    //     const firstPart = value.split('.')[0];
                    //     // console.log("🚀 ~ handleGetMetaData ~ firstPart:", firstPart)
                    //     const number = firstPart.replace(/\D/g, '');
                    //     fx = number;
                    //     fy = fieldReq;
                    // }
                    // const secondEntry = Object.entries(body)[1];
                    // var sx; 
                    // if(secondEntry){
                    //     const value = secondEntry[1];
                    //     // const fieldReq = secondEntry[0];
                    //     // console.log("🚀 ~ handleGetMetaData ~ fieldReq:", fieldReq)
                    //     // console.log("🚀 ~ handleGetMetaData ~ value:", value)
                    //     const firstPart = value.split('.')[0];
                    //     // console.log("🚀 ~ handleGetMetaData ~ firstPart:", firstPart)
                    //     const number = firstPart.replace(/\D/g, '');
                    //     sx = number;
                    // }

                    // // For Getting previous page data
                    // const flowdata = await db.query(`SELECT ${fy} FROM FEEDBACKS WHERE page_id = ${fx}`);
                    // let flowData = flowdata[0];
                    // // console.log("🚀 ~ handleGetMetaData ~ flowData:", flowData)

                    // // For Getting current page data
                    // const current = await db.query(`SELECT * FROM FEEDBACKS WHERE page_id = ${sx}`)
                    // let currentData = current[0];
                    // console.log("🚀 ~ handleGetMetaData ~ currentData:", currentData);
                    // // console.log("🚀 ~ handleGetMetaData ~ flowdata:", flowdata);
                    
                }
                    
                
                // console.log(apiUrls);
                
                // console.log("🚀 ~ handleGetMetaData ~ apiResponse:", apiResponse)
                

                // Fetching data for each api 
                // for (const apiUrl of apiUrls){
                //     const response = await axios.get(apiUrl);
                //     apiResponse.push(response.data);

                // }

                // console.log("🚀 ~ handleGetMetaData ~ apiResponse:", apiResponse)
                // console.log("🚀 ~ handleGetMetaData ~ item:", item)
                
                
            }
            // data.meta_data = item;
            
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
        const request_id = req.headers.request_id;
        const {page_id, result} = req.body;
        if(!page_id || !result || !request_id){
            return res.status(400).json({ msg: "All fields are required" });
        }

        const [existingData] = await db.query('SELECT * FROM feedbacks WHERE page_id = ? AND request_id = ?', [page_id, request_id]);

        if(existingData.length > 0){
            await db.query('Update feedbacks SET result = ? where page_id = ? AND request_id = ?', [JSON.stringify(result), page_id, request_id]);
            return res.json({msg: "Feedback updated successfully"})
        }else{
        
            const [dataArray] = await db.query('INSERT INTO feedbacks (result, page_id, request_id) VALUES (?, ?, ?)', [JSON.stringify(result), page_id, request_id]);
            return res.json({ msg: "Page saved Successfully", id: dataArray.insertId });
           }
        }catch{
            return res.json({ msg: "Error from mobile frontend"});
        }
    
}

async function handleGetMobileData(req, res){
    const {request_id} = req.headers;
    const [listStoredFeedback] = await db.query('SELECT * FROM feedbacks WHERE request_id = ?',  [request_id]);
    return res.json(listStoredFeedback);
}




// Send api data to mobile by pageId
// async function handleGetApiData(req, res){
//     const {flowid} = req.headers;
//     const {orderid} = req.query;    
//     const [rows] = await db.query('SELECT * FROM pages WHERE flow_id = ? AND order_id = ?', [flowid, orderid]);
//     const check = Object.hasOwn(rows[0].meta_data, 'api');
//     if(check == true){
//         const apiUrl = rows[0].meta_data.api;
//         // console.log("🚀 ~ handleGetApiData ~ apiUrl:", apiUrl)
//         await axios.get(apiUrl).then(response =>{
//             return res.status(200).json(response.data);
//         });
//     }else{
//         return res.status(400).json({msg: "No Api Available"});
//     }
    // const apiData = rows.map(e => JSON.stringify(e.meta_data));  
    // console.log("apiData", apiData);  
    // const resolveApiData = await handleFetchApiData(apiData);
    // res.status(200).json(resolveApiData);
// }

module.exports = {handleMetaData, handleGetMetaData, handleGetFlows, handleFeedbackData, handleGetMobileData, handlepost};