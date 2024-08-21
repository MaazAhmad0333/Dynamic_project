const {db} = require('../connection');
const axios = require('axios');




// Storing all Meta Data
async function handleMetaData(req, res){
    //validation

    let flowName = req.body.flow_name;
    const pagesArray   = req.body.pages;

    let [flowId] = await db.query('INSERT INTO flows (flow_name) VALUES (?)', [flowName]);
    flowId = flowId.insertId;
    let promises = [];
    for(let page of pagesArray) {
        const {page_id, meta_data, order_id} = page;
        promises.push(db.query('INSERT INTO pages (page_id, meta_data, order_id, flow_id) VALUES (?, ?, ?, ?)', [page_id, JSON.stringify(meta_data), order_id, flowId]));
    }

    const insertIds = await Promise.all(promises);
    return res.status(200).json({ message: 'Data saved successfully!'});
}

// Sending single record/row form the database 
async function handleGetFlows(req, res){
    const [flows] = await db.query('SELECT * FROM flows');
    return res.json(flows);
    
}

// Sending single record/row form the database 
async function handleGetMetaData(req, res){
    let token = null;
    let whereClause = "(SELECT MIN(orderId) FROM pages)";
    let queryValues = [];
    if(req.header.X_PAGE_TOKEN) {
        token = req.header.X_PAGE_TOKEN.toString("base64");
        whereClause = "?";
        queryValues.push(token.next_order_id);
    }

    queryValues.push(req.params.flow_id);
    const data = await db.query(`SELECT * FROM pages WHERE order_id = ${whereClause} AND flow_id = ? LIMIT 1`, queryValues);

    //verify if next page exists
    token = null;
    const orderId = await db.query(`SELECT orderId FROM pages WHERE orderId = ? AND flowId = ? LIMIT 1`, [data.orderId+1, flowId]);
    if(orderId) {
        token = {next_order_id: data.orderId}
        token = Buffer.from(token).toString('base64');
    }

    return res.json({metadata, token});
}


// Send api data to mobile by pageId
async function handleGetApiData(req, res){
    const {pageId} = req.params;
    const [rows] = await db.query('SELECT * FROM information WHERE pageId = ?', [pageId]);
    // console.log("Database rows", rows);
    const apiData = rows.map(e => JSON.stringify(e.metaData));  
    // console.log("apiData", apiData);  
    const resolveApiData = await handleFetchApiData(apiData);
    res.status(200).json(resolveApiData);
}

async function handleFetchApiData(rows) {
    return Promise.all(
        rows.map(async(data) =>{
            const jsonData = JSON.parse(data);

            if(jsonData && jsonData.blocks && Array.isArray(jsonData.blocks)){
                const resolvedBlocks = await Promise.all(
                    jsonData.blocks.map(async (block) =>{
                        if(block.type === "dropdown" && block.options){
                            const resolvedOptions = await Promise.all(
                                block.options.map(async(option) =>{
                                    if(option.api){
                                        try{
                                            const response = await axios.get(option.api);
                                            return { data: response.data };
                                        }
                                        catch(error){
                                            console.log("API fetch error", error);
                                            return option;
                                            
                                        }
                                    }
                                    return option;
                                })
                            );
                            return {...block, options: resolvedOptions};
                        }
                        return block;
                    })
                );
                return {...jsonData, blocks:resolvedBlocks};
            }
            return jsonData;
        })
    );
};

module.exports = {handleMetaData, handleGetMetaData, handleGetApiData, handleGetFlows};