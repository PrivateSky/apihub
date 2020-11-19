
const ALIAS_SYNC_ERR_CODE = 'sync-error';


function makeRequest(protocol, hostname, port, method, path, body, headers, callback) {

    const http = require("http");
    const https = require("https");

    if (typeof headers === "function") {
        callback = headers;
        headers = undefined;
    }

    if (typeof body === "function") {
        callback = body;
        headers = undefined;
        body = undefined;
    }

    protocol = require(protocol);
    const options = {
        hostname: hostname,
        port: port,
        path,
        method,
        headers
    };
    const req = protocol.request(options, response => {

        if (response.statusCode < 200 || response.statusCode >= 300) {
            return callback({
                statusCode: response.statusCode,
                err: new Error("Failed to execute command. StatusCode " + response.statusCode)
            }, null);
        }
        let data = [];
        response.on('data', chunk => {
            data.push(chunk);
        });

        response.on('end', () => {
            try {
                const bodyContent = Buffer.concat(data).toString();
                return callback(undefined, bodyContent);
            } catch (error) {
                return callback({
                    statusCode: 500,
                    err: error
                }, null);
            }
        });
    });

    req.on('error', err => {
        console.log(err);
        return callback({
            statusCode: 500,
            err: err
        });
    });

    req.write(body);
    req.end();
};





$$.flow.describe('ETH',{
    init : function (domainConfig, anchorId, jsonData, rootFolder) {
        this.commandData = {};
        this.commandData.anchorId = anchorId;
        this.commandData.jsonData = jsonData;
        this.commandData.option = domainConfig.option;
        const endpointURL =  new URL(domainConfig.option.endpoint);
        this.commandData.apiEndpoint = endpointURL.hostname;
        this.commandData.apiPort = endpointURL.port;
        this.commandData.protocol = endpointURL.protocol.replace(':',"");

    },
    addAlias : function (server, callback) {
        this.__SendToBlockChain(callback);
    },
    __SendToBlockChain : function(callback){
        const body = {
            "hash": {
                "newHashLinkSSI" : this.commandData.jsonData.hash.new,
                "lastHashLinkSSI" : this.commandData.jsonData.hash.last
            }
        };
        const bodyData = JSON.stringify(body);
        //build path
        const apiPath = '/addAnchor/'+this.commandData.anchorId;
        //run Command method
        const apiMethod = 'PUT';
        // run Command headers
        const apiHeaders = {
            'Content-Type': 'application/json',
            'Content-Length': bodyData.length
        };
        const apiEndpoint = this.commandData.apiEndpoint;
        const apiPort = this.commandData.apiPort;
        const protocol = this.commandData.protocol;
        try {
            makeRequest(protocol, apiEndpoint, apiPort, apiMethod, apiPath, bodyData, apiHeaders, (err, result) => {

                if (err) {
                    if (err.statusCode === 428){
                        return callback({
                            code: ALIAS_SYNC_ERR_CODE,
                            message: 'Unable to add alias: versions out of sync'
                        });
                    }
                    console.log(err);
                    callback(err, null);
                    return;

                }
                callback (null, result);
            })
        }catch (err) {
            console.log("anchoring smart contract Error: ",err);
            callback(err, null);
        }
    },
    readVersions: function (anchorID,server, callback) {
        this.__ReadFromBlockChain(anchorID, callback);
    },
    __ReadFromBlockChain : function(anchorID, callback){
        const body = {};
        const bodyData = JSON.stringify(body);
        //build path
        const apiPath = '/getAnchorVersions/'+anchorID;
        //run Command method
        const apiMethod = 'GET';
        // run Command headers
        const apiHeaders = {
            'Content-Type': 'application/json',
            'Content-Length': bodyData.length
        };
        const apiEndpoint = this.commandData.apiEndpoint;
        const apiPort = this.commandData.apiPort;
        const protocol = this.commandData.protocol;
        try {
            makeRequest(protocol, apiEndpoint, apiPort, apiMethod, apiPath, bodyData, apiHeaders, (err, result) => {

                if (err) {
                    console.log(err);
                    callback(err, null);
                    return;
                }

                callback(null, JSON.parse(result));
            })
        }catch (err) {
            console.log("anchoring smart contract Error: ",err);
            callback(err, null);
        }
    }
});


module.exports = {
    ALIAS_SYNC_ERR_CODE
};