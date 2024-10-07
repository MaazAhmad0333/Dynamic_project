
// Validation function associated with handleMetaData function in webController file
function validateMetaData(req){
    const flowName = req.body.flow_name;
    const variable = req.body.variable;
    const pagesArray = req.body.pages;

    if(!flowName){
        return { status: 400, msg: "Flow name is required" };
    }
    
    if(!variable){
        return { status: 400, msg: "Variables are required" };
    }

    
    if(!pagesArray){
        return { status: 400, msg: "Pages field is required" };
    }

    // If all validations pass
    return null;
}

function validateFeedbackData(req){
    const request_id = req.headers.request_id;
    const {page_id, result} = req.body;

    if(!request_id){
        return { status: 400, msg: "Request ID is required" };
    }
    
    if(!page_id){
        return { status: 400, msg: "Page ID is required" };
    }

    
    if(!result){
        return { status: 400, msg: "Result field is required" };
    }

    return null;
}

function validateDataResult(data) {
    if (!data.length) {
        return { status: 404, msg: "No pages found for the given flow_id" };
    }
    return null;
}


function validateVariableResult(searching) {
    if(!searching){
        console.log("No Variables found");
    }
    return null;
}




module.exports = {validateMetaData, validateFeedbackData, validateDataResult, validateVariableResult};