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
    let variable = req.body.variable;
    if(!variable){
        return res.status(400).json({msg: "Variables are required"});
    }

    const pagesArray = req.body.pages;
    // console.log("🚀 ~ handleMetaData ~ pagesArray:", pagesArray)
    if(!pagesArray){
        return res.status(400).json({msg: "Pages field is required"});
    }
    // Inserting new flow into flows table
    let [flowId] = await db.query('INSERT INTO flows (flow_name) VALUES (?)', [flowName]);
    flowId = flowId.insertId;

    // Inserting new variables data into flowvariable table
    let [variables] = await db.query('INSERT INTO flowVariables (variable, flow_id) VALUES (?,?)', [JSON.stringify(variable), flowId]);
    variables = variables.insertId;
    // console.log("🚀 ~ handleMetaData ~ variables:", variables)

    
    // Creating data on newly created flow
    let promises = [];
    for(let page of pagesArray) {
        const {step_type, meta_data, order_id} = page;
        promises.push(db.query('INSERT INTO pages (step_type, meta_data, order_id, flow_id) VALUES (?, ?, ?, ?)', [step_type, JSON.stringify(meta_data), order_id, flowId]));
    }
    const insertIds = await Promise.all(promises);
    return res.status(200).json({ message: 'Data saved successfully!'});
}






// Sending List of Flows
async function handleGetFlows(req, res){
    const [flows] = await db.query('SELECT * FROM flows');
    return res.json(flows);
    
}










// Just checking the post api request is working 
async function handlepost(req, res){
    const x = req.body;
    console.log("🚀 ~ handlepost ~ x:", x);
    return res.json({msg: "hello"});    
}









// Sending single record/row form the database 
async function handleGetMetaData(req, res){
    // console.log("🚀 ~ req:", req.query)
    // console.log("🚀 ~ req:", req.headers)
    let token = null;

    // ==============================Validating flow_id query parameter======================================= //
    if (!req.query.flow_id) {
        return res.status(400).json({ error: "flow_id is required" });
    }

    let whereClause = "(SELECT MIN(order_id) FROM pages WHERE flow_id = ? AND step_type != 'api' AND order_id != 0)";
    let queryValues = [];


    // console.log(req.headers.x_page_token)
    if(req.headers.x_page_token){

        let bufferObj = Buffer.from(req.headers.x_page_token, "base64");
        // console.log("🚀 ~ handleGetMetaData ~ req.headers.x_page_token,:", req.headers.x_page_token)
        let token = bufferObj.toString("utf8");
        token = JSON.parse(token)

        // =========================================Validate token structure============================ //
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
        token = {next_order_id: orderInfo.order_id };
        // console.log("🚀 ~ handleGetMetaData ~ token:", token)
        buffer = Buffer.from(JSON.stringify(token), 'utf-8');
        // console.log("🚀 ~ handleGetMetaData ~ buffer:", buffer)
        token = buffer.toString('base64');
        // console.log("🚀 ~ handleGetMetaData ~ token:", token)    
    }

    

    let [apidetails] = await db.query('SELECT * FROM pages where flow_id = ? AND step_type = "api"', [data.flow_id])
    // console.log("🚀 ~ handleGetMetaData ~ apidetails:", apidetails)   
    // apidetails = apidetails[0];
    


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
                                    // console.log("this is it", item[key]); this will display its value e.g {{itemName}}
                                    // console.log("this is Key", key);  this will display the key e.g option
                                    let abc = { word: key, value: val };
                                    xyz = abc.word;
                                    // varMatch = (abc.value).replace(/\{\{(.*?)\}\}/, '$1').trim();
                                    varMatch.push((abc.value).replace(/\{\{(.*?)\}\}/, '$1').trim());
                                }
                            })
                        }
                            
                    }


                    if(xyz && input.hasOwnProperty(xyz)){
                        console.log("coming here")
                        for(let apiObj of apidetails){
                            // if(apiObj.meta_data[0].details.Success.Response.Variable === varMatch){
                            if(varMatch.some(element => element === apiObj.meta_data[0].details.Success.Response.Variable)){
                                httpType = apiObj.meta_data[0].details.Type;
                                    if(httpType === "get" || httpType === "Get"){
                                        const flowid = data.flow_id;
                                        const apiUrls = apiObj.meta_data[0].details.Url;
                                        if(Array.isArray(apiUrls)){
                                            return res.json({msg: "Url key has multiple values only single is required"});
                                        }
        
                                        let apiResponse;
                                        let params = '';
                                        let firstParam = true;
                                        for(let fld in apiObj.meta_data[0].details.Param){
        
                                            if(firstParam) {
                                                firstParam = false;
                                                params += '?';
                                            }
                                            else {
                                                params += '&';
                                            }
        
                                            // console.log("=======================", apiFieldCheck.details.Param[fld])
                                            let paramsUrl = [];
                                            let [searching] = await db.query('SELECT * FROM flowvariables where flow_id = ?' ,[flowid]);
                                            searching = searching[0];
                                            if(!searching){
                                                console.log("No Variables data found");
                                            }
        
                                            const variables = searching.variable;
                                            for (let item of variables) {
                                                if (item.key === apiObj.meta_data[0].details.Param[fld]) {
                                                    let [mobileData] = await db.query('Select feedbacks.* From feedbacks JOIN pages ON feedbacks.page_id = pages.id WHERE  pages.flow_id = ?', [flowid]);
                                                    const mobileDatas = mobileData[0];
        
                                                    let reqVariables = mobileDatas.result[item.key];
                                                    paramsUrl.push(reqVariables);
                                                }
                                            }
                                            params += fld + '=' + paramsUrl;
                                            // params += fld + '=' + apiFieldCheck.details.Param[fld];
                                        }
                                        let API_URL = apiUrls+params;
                                        console.log("🚀 ~ handleGetMetaData ~ API_URL:", API_URL)
                                        const response = await axios.get(API_URL);
                                        apiResponse = response.data;

                                        let extractedData;
                                        if((apiObj.meta_data[0].details.Success.Response.field).length > 0){
                                            
                                            if(Array.isArray(apiResponse)){
                                                extractedData = apiResponse.map(data=>{
                                                    let extData = {}
                
                                                        for(let fld of apiObj.meta_data[0].details.Success.Response.field){
                                                            extData[fld] = data[fld]
                                                        }
                                                        return extData;
                                                    
                                                })
                                            }else {
                                                let extData = {}
                                                for(let fld of apiObj.meta_data[0].details.Success.Response.field){
                                                    extData[fld] = data[fld]
                                                }
                                                extractedData = [extData]
                                            }
                                            
                                        }else{
                                            extractedData = null;
                                        }
                                        
                                        input[xyz] = extractedData;
                                    }
                                    else if(httpType === "post" || httpType === "Post"){
                                        const flowid = data.flow_id;
                                        const apiUrls = apiObj.meta_data[0].details.Url;
                                        console.log("🚀 ~ handleGetMetaData ~ apiUrls:", apiUrls)
                                        if(Array.isArray(apiUrls)){
                                            return res.json({msg: "Url key has multiple values only single is required"});
                                        }
                                        let body = apiObj.meta_data[0].details.Body;
                                        const entries = Object.entries(body);
                                        let reqVariablesdata = [];
                                        for(let objectentries of entries){
                                            const value = objectentries[1];
                                            const match = value.replace(/\{\{(.*?)\}\}/, '$1').trim();
                                            let [searching] = await db.query('SELECT * FROM flowvariables where flow_id = ?' ,[flowid]);
                                            searching = searching[0];
        
                                            if(!searching){
                                                console.log("No Variables found");
                                            }
        
                                            const variables = searching.variable;
                                            for (let item of variables) {
                                                if (item.key === match) {
                                                   let [mobileData] = await db.query('Select feedbacks.* From feedbacks JOIN pages ON feedbacks.page_id = pages.id WHERE  pages.flow_id = ?', [flowid]);
                                                
                                                   const mobileDatas = mobileData[0];
                                                   if(mobileDatas){
        
                                                       let reqVariables = mobileDatas.result[item.key];
                                                       console.log("🚀 ~ reqVariables:", reqVariables)
                                                       
                                                       reqVariablesdata.push(reqVariables);
                                                   }
                                                //    console.log("----------------",mobileDatas.result[item.key])
                                                }
                                            }
                                        }              
                                            const response = await axios.post(apiUrls, reqVariablesdata);
                                            // item.newStatus = response.status;     
                                    }
                            }
                            // const [apiFieldCheck] = apiObj.filter((meta)=> meta.details.Success.Response.Variable === varMatch)
                            // console.log("🚀 ~ handleGetMetaData ~ apiNameCheck:", apiFieldCheck);        
                        }
                    }
                }
            }else{
                console.log("hello world")
                for(let key in item){    
                    // console.log("🚀 ~ handleGetMetaData ~ key:", key.fields)
                    const value = item[key];
                    // console.log("🚀 ~ handleGetMetaData ~ value:", value)
                    if(Array.isArray(value)){
                        value.forEach((val,index) =>{
                            if(typeof val === 'string' && val.includes('{{') && val.includes('}}')){
                                // console.log("this is it", item[key]); this will display its value e.g {{itemName}}
                                // console.log("this is Key", key);  this will display the key e.g option
                                let abc = { word: key, value: val };
                                xyz = abc.word;
                                // console.log("🚀 ~ value.forEach ~ abc:", abc.value)
                                // console.log("🚀 ~ handleGetMetaData ~ xyz:", xyz)
                                varMatch.push((abc.value).replace(/\{\{(.*?)\}\}/, '$1').trim());
                                console.log("🚀 ~ value.forEach ~ varMatch:", varMatch)
                                
                                
                            }
                        })
                    }
                    
                    
                    
                }
                if(xyz && item.hasOwnProperty(xyz)){
                    for(let apiObj of apidetails){
                        
                        // if(apiObj.meta_data[0].details.Success.Response.Variable === varMatch){
                        if(varMatch.some(element => element === apiObj.meta_data[0].details.Success.Response.Variable)){
                            httpType = apiObj.meta_data[0].details.Type;
                            if(httpType === "get" || httpType === "Get"){
                                const flowid = data.flow_id;
                                const apiUrls = apiObj.meta_data[0].details.Url;
                                if(Array.isArray(apiUrls)){
                                    return res.json({msg: "Url key has multiple values only single is required"});
                                }
        
                                let apiResponse;
                                let params = '';
                                let firstParam = true;
                                for(let fld in apiObj.meta_data[0].details.Param){
        
                                    if(firstParam) {
                                        firstParam = false;
                                        params += '?';
                                    }
                                    else {
                                        params += '&';
                                    }
        
                                    // console.log("=======================", apiFieldCheck.details.Param[fld])
                                    let paramsUrl = [];
                                    let [searching] = await db.query('SELECT * FROM flowvariables where flow_id = ?' ,[flowid]);
                                    searching = searching[0];
                                    if(!searching){
                                        console.log("No Variables data found");
                                    }
        
                                    const variables = searching.variable;
                                    for (let item of variables) {
                                        if (item.key === apiObj.meta_data[0].details.Param[fld]) {
                                            let [mobileData] = await db.query('Select feedbacks.* From feedbacks JOIN pages ON feedbacks.page_id = pages.id WHERE  pages.flow_id = ?', [flowid]);
                                            const mobileDatas = mobileData[0];
        
                                            let reqVariables = mobileDatas.result[item.key];
                                            paramsUrl.push(reqVariables);
                                        }
                                    }
                                    params += fld + '=' + paramsUrl;
                                    // params += fld + '=' + apiFieldCheck.details.Param[fld];
                                }
                                let API_URL = apiUrls+params;
                                console.log("🚀 ~ handleGetMetaData ~ API_URL:", API_URL)
                                const response = await axios.get(API_URL);
                                apiResponse = response.data;
                                // console.log("🚀 ~ handleGetMetaData ~ response.data:", apiResponse)
                                // console.log("apiResponse", apiResponse)
                                let extractedData;
                                if((apiObj.meta_data[0].details.Success.Response.field).length > 0){
                                    
                                    extractedData = apiResponse.map(data=>{
                                        let extData = {}
        
                                            for(let fld of apiObj.meta_data[0].details.Success.Response.field){
                                                extData[fld] = data[fld]
                                            }
                                            return extData;
                                        
                                    })
                                }else{
                                    extractedData = null;
                                }
                                
                                item[xyz] = extractedData;
                                // console.log("🚀 ~ extractedData:", extractedData)
                            }
                            else if(httpType === "post" || httpType === "Post"){
                                // -> commented for testing
                                const flowid = data.flow_id;
                                // console.log("🚀 ~ handleGetMetaData ~ flowid:", flowid)
                                const apiUrls = apiObj.meta_data[0].details.Url;
                                console.log("🚀 ~ handleGetMetaData ~ apiUrls:", apiUrls)
                                if(Array.isArray(apiUrls)){
                                    return res.json({msg: "Url key has multiple values only single is required"});
                                }
                                let body = apiObj.meta_data[0].details.Body;
                                // console.log("🚀 ~ handleGetMetaData ~ body:", body)
                                // Making the code dynamic
                                const entries = Object.entries(body);
                                // let storedData = [];
                                let reqVariablesdata = [];
                                for(let objectentries of entries){
                                    // console.log("🚀 ~ handleGetMetaData ~ objectentries:", objectentries)
                                    const value = objectentries[1];
                                    const match = value.replace(/\{\{(.*?)\}\}/, '$1').trim();
                                    let [searching] = await db.query('SELECT * FROM flowvariables where flow_id = ?' ,[flowid]);
                                    searching = searching[0];
        
                                    if(!searching){
                                        console.log("No Variables found");
                                    }
        
                                    const variables = searching.variable;
                                    for (let item of variables) {
                                        if (item.key === match) {
                                           let [mobileData] = await db.query('Select feedbacks.* From feedbacks JOIN pages ON feedbacks.page_id = pages.id WHERE  pages.flow_id = ?', [flowid]);
                                        
                                           const mobileDatas = mobileData[0];
                                           if(mobileDatas){
        
                                               let reqVariables = mobileDatas.result[item.key];
                                               console.log("🚀 ~ reqVariables:", reqVariables)
                                               
                                               reqVariablesdata.push(reqVariables);
                                           }
                                           
                                        }
                                    }
        
                                }
                                    
                                    // console.log("🚀 ~ handleGetMetaData ~ reqVariables:", reqVariablesdata)                
                                    const response = await axios.post(apiUrls, reqVariablesdata);
                                    // console.log("🚀 ~ handleGetMetaData ~ response:", response)
                                    // item.newStatus = response.status;
                                    
                            } 
                        }
                    }
                    // const [apiFieldCheck] = apidetails.meta_data.filter((meta)=> meta.details.Success.Response.Variable === varMatch)
                    // console.log("🚀 ~ handleGetMetaData ~ apiNameCheck:", apiFieldCheck);
                }
            }

            // ================================Extracting variables value in Summary ===================================== //
            let [searching] = await db.query('SELECT * FROM flowvariables where flow_id = ?' ,[data.flow_id]);
            searching = searching[0];
            if(!searching){
                console.log("No Variables found");
            }
            let fieldLength
            if(item.fields){
                fieldLength = item.fields.length;
            }
            
            let {request_id} = req.headers;
            console.log("🚀 ~ reqId:", typeof(request_id))
            const variables = searching.variable;
            let [mobileData] = await db.query('Select feedbacks.* From feedbacks JOIN pages ON feedbacks.page_id = pages.id WHERE  pages.flow_id = ? And feedbacks.request_id = ?', [data.flow_id, request_id]);
            // const mobileDatas = mobileData[0];
            let mobileDatas ={}
            for(let objdata of mobileData){
                console.log("🚀 ~ objdata:", objdata)
                for(let key in objdata.result) {
                    // console.log("🚀 ~ key:", key)
                    mobileDatas[key] = objdata.result[key]
                }
            }
            // console.log("🚀 ~ objefdsf:", mobileDatas)
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
                        // console.log("🚀 ~ item.fields:", item.fields)
                        // console.log("🚀 ~ keyValuePair:", keyValuePair)
                        item.fields.push(keyValuePair);
                        // item.fields = reqVariables;
                    }
                    else{
                        return res.json({msg: "There is no data coming in the mobiledata check query"})
                        // console.log("--------Empty-------------")
                        // const emptyKeyValuePair = {
                        //     [item1.key]: null
                        // };
                        // console.log("🚀 ~ emptyKeyValuePair:", emptyKeyValuePair)
            
                        // // Ensure `item.fields` is an array
                        // if (!Array.isArray(item.fields)) {
                        //     item.fields = [];
                        // }
                        // if(item.fields.length > 0 && typeof item.fields[0] == 'string' ){

                        //     item.fields = item.fields.slice(1, fieldLength)
                        // }
            
                        // // Push null value for the key
                        // item.fields.push(emptyKeyValuePair);
                    }                           
                }
            }    
        }
    }
    
    

    // if (data.meta_data) {       
    //     for (const item of data.meta_data){
    //         if(item.api){
    //             // // -> commented for testing
    //             // // console.log("item spi", item.api)
    //             // httpType = item.api.Type;
    //             // console.log("🚀 ~ handleGetMetaData ~ httpType:", httpType)
    //             // if(httpType === "get" || httpType === "Get"){
    //             //     const apiUrls = item.api.Url
    //             //     if(Array.isArray(apiUrls)){
    //             //         return res.json({msg: "Url key has multiple values only single is required"});
    //             //     }
    //             //     let apiResponse;
                    
    //             //     let params = '';
    //             //     let firstParam = true;
    //             //     for(let fld in item.api.Success.Request){
    //             //         if(firstParam) {
    //             //             firstParam = false;
    //             //             params += '?';
    //             //         }
    //             //         else {
    //             //             params += '&';
    //             //         }
    //             //         params += fld + '=' + item.api.Success.Request[fld];
    //             //     }
    //             //     let API_URL = apiUrls+params;
    //             //     console.log("🚀 ~ handleGetMetaData ~ API_URL:", API_URL)
    //             //     const response = await axios.get(API_URL);
    //             //     apiResponse = response.data;
    //             //     // console.log("apiResponse", apiResponse)
    //             //     const extractedData = apiResponse.map(data=>{
    //             //         let extData = {}
    //             //         for(let fld of item.api.Success.Response.field){
    //             //             extData[fld] = data[fld]
    //             //         }
    //             //         return extData;
    //             //     })
    //             //     // console.log("🚀 ~ extractedData ~ extractedData:", extractedData);
    //             //     delete item.api;
    //             //     // item.api.Success.Response.data = extractedData;
    //             //     item.data = extractedData;
    //             // // -> commented for testing
                    
    //             // }else if(httpType === "post" || httpType === "Post"){
    //             //     // -> commented for testing
    //             //     const flowid = data.flow_id;
    //             //     // console.log("🚀 ~ handleGetMetaData ~ flowid:", flowid)
    //             //     const apiUrls = item.api.Url
    //             //     // console.log("🚀 ~ handleGetMetaData ~ apiUrls:", apiUrls)
    //             //     if(Array.isArray(apiUrls)){
    //             //         return res.json({msg: "Url key has multiple values only single is required"});
    //             //     }
    //             //     let body = item.api.Body;
                    
    //             //     // Making the code dynamic
    //             //     const entries = Object.entries(body);
    //             //     let storedData = [];
    //             //     for(let objectentries of entries){
    //             //         const value = objectentries[1];
    //             //         // console.log("🚀 ~ handleGetMetaData ~ value:", value) output: page1.feedback.id
    //             //         const fieldReq = objectentries[0];
    //             //         // console.log("🚀 ~ handleGetMetaData ~ fieldReq:", fieldReq) output: "id":
    //             //         const firstPart = value.split('.')[0];
    //             //         const number = firstPart.replace(/\D/g, '');
    //             //         const newid = data.flow_id;
    //             //         const abc = await db.query(`Select feedbacks.* From feedbacks JOIN pages ON feedbacks.page_id = pages.id WHERE pages.order_id = ${number} AND pages.flow_id = ${newid} ;`);
    //             //         abcData = abc[0];
    //             //         if(abcData.length > 0){
    //             //             storedData.push(...abcData);    
    //             //         }
    //             //         // storedData = abc[0];
    //             //     }

    //             //     let requestBody = {
    //             //         PagesData: storedData 
    //             //     };

    //             //     const response = await axios.post(apiUrls, storedData);
    //             //     item.api.Success.Response.newStatus = response.status;
    //             //     // -> commented for testing




    //                 // const firstEntry = Object.entries(body)[0];
    //                 // var fx, fy; 
    //                 // if(firstEntry){
    //                 //     const value = firstEntry[1];
    //                 //     const fieldReq = firstEntry[0];
    //                 //     // console.log("🚀 ~ handleGetMetaData ~ fieldReq:", fieldReq)
    //                 //     // console.log("🚀 ~ handleGetMetaData ~ value:", value)
    //                 //     const firstPart = value.split('.')[0];
    //                 //     // console.log("🚀 ~ handleGetMetaData ~ firstPart:", firstPart)
    //                 //     const number = firstPart.replace(/\D/g, '');
    //                 //     fx = number;
    //                 //     fy = fieldReq;
    //                 // }
    //                 // const secondEntry = Object.entries(body)[1];
    //                 // var sx; 
    //                 // if(secondEntry){
    //                 //     const value = secondEntry[1];
    //                 //     // const fieldReq = secondEntry[0];
    //                 //     // console.log("🚀 ~ handleGetMetaData ~ fieldReq:", fieldReq)
    //                 //     // console.log("🚀 ~ handleGetMetaData ~ value:", value)
    //                 //     const firstPart = value.split('.')[0];
    //                 //     // console.log("🚀 ~ handleGetMetaData ~ firstPart:", firstPart)
    //                 //     const number = firstPart.replace(/\D/g, '');
    //                 //     sx = number;
    //                 // }

    //                 // // For Getting previous page data
    //                 // const flowdata = await db.query(`SELECT ${fy} FROM FEEDBACKS WHERE page_id = ${fx}`);
    //                 // let flowData = flowdata[0];
    //                 // // console.log("🚀 ~ handleGetMetaData ~ flowData:", flowData)

    //                 // // For Getting current page data
    //                 // const current = await db.query(`SELECT * FROM FEEDBACKS WHERE page_id = ${sx}`)
    //                 // let currentData = current[0];
    //                 // console.log("🚀 ~ handleGetMetaData ~ currentData:", currentData);
    //                 // // console.log("🚀 ~ handleGetMetaData ~ flowdata:", flowdata);
                    
    //             // } 
                    
                
    //             // console.log(apiUrls);
                
    //             // console.log("🚀 ~ handleGetMetaData ~ apiResponse:", apiResponse)
                

    //             // Fetching data for each api 
    //             // for (const apiUrl of apiUrls){
    //             //     const response = await axios.get(apiUrl);
    //             //     apiResponse.push(response.data);

    //             // }

    //             // console.log("🚀 ~ handleGetMetaData ~ apiResponse:", apiResponse)
    //             // console.log("🚀 ~ handleGetMetaData ~ item:", item)
                
                
    //         }
    //         // data.meta_data = item;
            
    //     }
  
    // }
    
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








// async function handleGetMobileData(req, res){
//     const {request_id} = req.headers;
//     const [listStoredFeedback] = await db.query('SELECT * FROM feedbacks WHERE request_id = ?',  [request_id]);
//     return res.json(listStoredFeedback);
// }




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

module.exports = {handleMetaData, handleGetMetaData, handleGetFlows, handleFeedbackData, handlepost};