const {db} = require('../connection');
const axios = require('axios');

// Storing all Meta Data
async function handleMetaData(req, res){
    // const {pageId, metaData}   = req.body;
    const data   = req.body;
    if (!Array.isArray(data)) {
        return res.status(400).json({ message: 'Invalid data format. Expected an array of objects.' });
    }
    // console.log(req.body);
    const promises = data.map(async (item) =>{
        const {pageId, metaData, orderId} = item;

        if(!metaData){
            return res.status(400).json({ message: ' metadata is required!' });
        }
    
        if (!pageId) {
            return res.status(400).json({ message: 'PageId  is required!' });
        }

        const [result] = await db.query('INSERT INTO information (pageId, metaData, orderId) VALUES (?, ?, ?)', [pageId, JSON.stringify(metaData), orderId]);
        return result.insertId;
        // return res.status(200).json({ message: 'Data saved successfully!', id: result.insertId });
        
    });

    const insertIds = await Promise.all(promises);
    return res.status(200).json({ message: 'Data saved successfully!', ids: insertIds });

}

// Sending single record/row form the database 
async function handleGetMetaData(req, res){
    // const [metadata] = await db.query('SELECT * FROM information');
    const [metadata] = await db.query('SELECT * FROM information WHERE orderId = (SELECT MIN(orderId) FROM information)');
    const orderNum = metadata[0];
    const num = orderNum.orderId+1;
    // console.log(num);
    return res.json({metadata, nextOrderId:num});
    
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

module.exports = {handleMetaData, handleGetMetaData, handleGetApiData};