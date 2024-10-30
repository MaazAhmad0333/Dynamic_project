const {db} = require('../connection');

// Storing New Flow
async function saveFlowData(flowName) {
    const [flowIdResult] = await db.query('INSERT INTO flows (flow_name) VALUES (?)', [flowName]);
    return flowIdResult;
    

}

// Storing New variables
async function saveVariableData(variable, flowId){
    const [variableIdResult] = await db.query('INSERT INTO flowvariables (variable, flow_id) VALUES (?,?)', [JSON.stringify(variable), flowId]);
    return variableIdResult;
    
}


// Storing New data in pages
async function savePagesData(step_type, meta_data, order_id, flowId){
    const [pagesIdResult] = await db.query('INSERT INTO pages (step_type, meta_data, order_id, flow_id) VALUES (?, ?, ?, ?)', [step_type, JSON.stringify(meta_data), order_id, flowId]);
    return pagesIdResult;
}

async function extractingFlows() {
    const [flowsList] = await db.query('SELECT * FROM flows');
    return flowsList;
}


async function extractingFeedback(page_id, request_id) {
    const [feedbackData] = await db.query('SELECT * FROM feedbacks WHERE page_id = ? AND request_id = ?', [page_id, request_id]);
    return feedbackData;
}

async function updateFeedbacks(result, page_id, request_id) {
    const [feedbackUpdate] = await db.query('Update feedbacks SET result = ? where page_id = ? AND request_id = ?', [JSON.stringify(result), page_id, request_id]);
    return feedbackUpdate;
}

async function createFeedback(result, page_id, request_id) {
    const [newFeedback] = await db.query('INSERT INTO feedbacks (result, page_id, request_id) VALUES (?, ?, ?)', [JSON.stringify(result), page_id, request_id])
    return newFeedback;
}

async function getApiDetails(flow_id) {
    const [apiDetails] = await db.query('SELECT * FROM pages WHERE flow_id = ? AND step_type = "api"', [flow_id]);
    return apiDetails;
}

async function getFlowVariables(flow_id) {
    const [variables] = await db.query('SELECT * FROM flowvariables WHERE flow_id = ?', [flow_id]);
    return variables[0];
}


async function getMobileData(flow_id, request_id) {
    const [mobileData] = await db.query('SELECT feedbacks.* FROM feedbacks JOIN pages ON feedbacks.page_id = pages.id WHERE pages.flow_id = ? AND feedbacks.request_id = ?', [flow_id, request_id]);
    return mobileData;
}

async function getVariables(flow_id) {
    const [variables] = await db.query('SELECT * FROM flowvariables WHERE flow_id = ?', [flow_id]);
    return variables[0] || null;
}

async function getApiMobileData(flow_id) {
    const [mobileData] = await db.query(`
        SELECT feedbacks.* 
        FROM feedbacks 
        JOIN pages ON feedbacks.page_id = pages.id 
        WHERE pages.flow_id = ?`, [flow_id]);
    return mobileData;
}


async function getPageData(whereClause, queryValues) {
    let query = `SELECT * FROM pages WHERE order_id = (${whereClause}) AND flow_id = ? LIMIT 1`;
    let [dataResult] = await db.query(query, queryValues);
    return dataResult;
}

async function getNextPage([order_id, flow_id]) {
    query = `SELECT order_id FROM pages WHERE order_id = ? AND flow_id = ? LIMIT 1`;
    let [orderData] = await db.query(query, [order_id, flow_id]);
    return orderData[0];
}

module.exports = {saveFlowData , saveVariableData, savePagesData, extractingFlows, extractingFeedback, updateFeedbacks, createFeedback, getApiDetails, getFlowVariables, getMobileData, getVariables, getApiMobileData, getPageData, getNextPage};