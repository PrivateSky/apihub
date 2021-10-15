const { ALIAS_SYNC_ERR_CODE } = require("../../utils");

function sendToBlockChain(commandData, callback) {
    const body = {
        hash: {
            newHashLinkSSI: commandData.jsonData.hashLinkIds.new,
            lastHashLinkSSI: commandData.jsonData.hashLinkIds.last,
        },
        digitalProof: {
            signature: commandData.jsonData.digitalProof.signature,
            publicKey: commandData.jsonData.digitalProof.publicKey,
        },
        zkp: commandData.jsonData.zkp,
    };

   const bodyData = JSON.stringify(body);
   const options = {
        headers:  {
            "Content-Type": "application/json",
            "Content-Length": bodyData.length
        }
    };

    if(commandData.domainConfig && commandData.domainConfig.useProxy){
        options.useProxy = commandData.domainConfig.useProxy;
    }

    let endpoint = commandData.option.endpoint;

    if(endpoint[endpoint.length-1]==="/"){
        endpoint = endpoint.slice(0, endpoint.length-1);
    }
    endpoint = `${endpoint}/addAnchor/${commandData.anchorId}`;

    const http = require("opendsu").loadApi("http");
    http.doPut(endpoint, bodyData, options, (err, result)=>{
        if (err) {
            if (err.statusCode === 428) {
                return callback({
                    code: ALIAS_SYNC_ERR_CODE,
                    message: "Unable to add alias: versions out of sync",
                });
            }
            console.log(err);
            callback(err, null);
            return;
        }
        callback(null, result);
    });
}

function readFromBlockChain(commandData, callback) {
    const options = {};

    if(commandData.domainConfig && commandData.domainConfig.useProxy){
        options.useProxy = commandData.domainConfig.useProxy;
    }

    let endpoint = commandData.option.endpoint;

    if(endpoint[endpoint.length-1]==="/"){
        endpoint = endpoint.slice(0, endpoint.length-1);
    }
    endpoint = `${endpoint}/getAnchorVersions/${commandData.anchorId}`;

    const http = require("opendsu").loadApi("http");
    http.doGet(endpoint, options, (err, result)=>{
        if (err) {
            console.log(err);
            callback(err, null);
            return;
        }

        callback(null, JSON.parse(result));
    });
}

module.exports = {
    ALIAS_SYNC_ERR_CODE,
    sendToBlockChain,
    readFromBlockChain,
};
