const {ALIAS_SYNC_ERR_CODE} = require("../../utils");

function Ethx(server, domainConfig, anchorId, newAnchorValue, jsonData) {
    const openDSU = require("opendsu");
    const http = openDSU.loadAPI("http");
    const logger = $$.getLogger("Eth", "apihub/anchoring");
    const createEndpoint = (action) => {
        let endpoint = domainConfig.option.endpoint;

        if (endpoint.endsWith("/")) {
            endpoint = endpoint.slice(0, endpoint.length - 1);
        }
        endpoint = `${endpoint}/${action}`;
        if (anchorId) {
            endpoint = `${endpoint}/${anchorId}`;
        }

        if (newAnchorValue) {
            endpoint = `${endpoint}/${newAnchorValue}`;
        }

        return endpoint;
    }

    const writeToBlockchain = (action, callback) => {
        let options = {};
        let bodyData = "";
        if (jsonData) {
            bodyData = JSON.stringify(jsonData);
            options = {
                headers: {
                    "Content-Type": "application/json", "Content-Length": bodyData.length
                }
            }
        }

        if (domainConfig && domainConfig.useProxy) {
            options.useProxy = domainConfig.useProxy;
        }

        const endpoint = createEndpoint(action);
        http.doPut(endpoint, bodyData, options, (err, result) => {
            if (err) {
                if (err.statusCode === 428) {
                    const error = Error("Unable to add alias: versions out of sync");
                    error.code = ALIAS_SYNC_ERR_CODE;
                    return callback(error);
                }
                logger.error(err);
                callback(err);
                return;
            }
            callback(null, result);
        });
    }

    const readJSONFromBlockchain = (action, callback)=>{
        const endpoint = createEndpoint(action);
        let headers;
        let body = "";
        if (jsonData) {
            body = JSON.stringify(jsonData);
            headers = {
                "Content-Type": "application/json", "Content-Length": body.length
            }
        }
        http.fetch(endpoint, {
            method: 'GET',
            headers, body
        })
            .then(res => res.json())
            .then(data => callback(undefined, data))
            .catch(e => {
                return callback(e);
            });
    }

    const readFromBlockchain = (action, callback) => {
        const endpoint = createEndpoint(action);
        http.fetch(endpoint, {
            method: 'GET'
        })
            .then(res => res.text())
            .then(data => callback(undefined, data))
            .catch(e => {
                return callback(e);
            })
    }

    this.createAnchor = (callback) => {
        writeToBlockchain("createAnchor", callback);
    }

    this.appendAnchor = (callback) => {
        writeToBlockchain("appendAnchor", callback);
    }

    this.createOrUpdateMultipleAnchors = (callback) => {
        writeToBlockchain("createOrUpdateMultipleAnchors", callback);
    }

    this.getAllVersions = (callback) => {
        readJSONFromBlockchain("getAllVersions", callback);
    }

    this.getLastVersion = (callback) => {
        readFromBlockchain("getLastVersion", callback);
    }

    this.totalNumberOfAnchors = (callback) => {
        readFromBlockchain("totalNumberOfAnchors", callback);
    }

    this.dumpAnchors = (callback) => {
        readJSONFromBlockchain("dumpAnchors", callback);
    }
}

module.exports = Ethx;