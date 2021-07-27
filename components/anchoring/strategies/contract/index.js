const { getDomainFromKeySSI } = require("../../utils");

class Contract {
    constructor(server, domainConfig, anchorId, jsonData) {
        this.server = server;
        const domainName = getDomainFromKeySSI(anchorId);
        this.commandData = {};
        this.commandData.option = domainConfig.option;
        this.commandData.domain = domainName;
        this.commandData.anchorId = anchorId;
        this.commandData.jsonData = jsonData || {};
    }

    createAnchor(callback) {
        const { anchorId } = this.commandData;
        this._makeLocalContractRequest("createAnchor", [anchorId], callback);
    }

    createNFT(callback) {
        const { anchorId } = this.commandData;
        this._makeLocalContractRequest("createNFT", [anchorId], callback);
    }

    appendToAnchor(callback) {
        const {
            anchorId,
            jsonData: { hashLinkIds, digitalProof, zkp },
        } = this.commandData;
        this._makeLocalContractRequest("appendToAnchor", [anchorId, hashLinkIds, digitalProof, zkp], callback);
    }

    getAllVersions(callback) {
        const { anchorId } = this.commandData;
        this._makeLocalContractRequest("getAllVersions", [anchorId], callback);
    }

    getLatestVersion(callback) {
        const { anchorId } = this.commandData;
        this._makeLocalContractRequest("getLatestVersion", [anchorId], callback);
    }

    async _makeLocalContractRequest(methodName, methodParams, callback) {
        const { domain } = this.commandData;

        if (typeof methodParams === "function") {
            callback = methodParams;
            methodParams = null;
        }

        const requestMethod = "POST";
        const url = `/contracts/${domain}/safe-command`;
        const contractCommand = JSON.stringify({
            domain,
            contractName: "anchoring",
            methodName,
            params: methodParams,
        });
        const requestHeaders = {
            "Content-Type": "application/json",
            "Content-Length": contractCommand.length,
        };

        try {
            const makeLocalRequest = $$.promisify(this.server.makeLocalRequest.bind(this.server));
            let response = await makeLocalRequest(requestMethod, url, contractCommand, requestHeaders);

            if (response) {
                try {
                    response = JSON.parse(response);
                } catch (error) {
                    // the response isn't a JSON so we keep it as it is
                }

                if (response.optimisticResult) {
                    try {
                        response.optimisticResult = JSON.parse(response.optimisticResult);
                    } catch (error) {
                        // the response isn't a JSON so we keep it as it is
                    }

                    return callback(null, response.optimisticResult);
                }
            }

            callback(null, response);
        } catch (err) {
            console.warn(`[Anchoring] Failed to call method '${method}' for contract 'anchoring' for domain '${domain}'`);
            callback(err);
        }
    }
}

module.exports = Contract;
