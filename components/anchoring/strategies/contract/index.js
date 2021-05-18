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
        const { domain, anchorId } = this.commandData;
        this._makeLocalContractRequest("createAnchor", [anchorId], callback);
    }

    createNFT(callback) {
        const { domain, anchorId } = this.commandData;
        this._makeLocalContractRequest("createNFT", [anchorId], callback);
    }

    appendToAnchor(callback) {
        const {
            domain,
            anchorId,
            jsonData: { hashLinkIds, digitalProof, zkp },
        } = this.commandData;
        this._makeLocalContractRequest("appendToAnchor", [anchorId, hashLinkIds, digitalProof, zkp], callback);
    }

    getAllVersions(callback) {
        const { domain, anchorId } = this.commandData;
        this._makeLocalContractRequest("getAllVersions", [anchorId], callback);
    }

    getLatestVersion(callback) {
        const { domain, anchorId } = this.commandData;
        this._makeLocalContractRequest("getLatestVersion", [anchorId], callback);
    }

    async _makeLocalContractRequest(method, methodParams, callback) {
        const { domain } = this.commandData;

        if (typeof methodParams === "function") {
            callback = methodParams;
            methodParams = null;
        }

        if (methodParams) {
            const crypto = require("opendsu").loadAPI("crypto");
            methodParams = crypto.encodeBase58(JSON.stringify(methodParams));
        }

        const requestMethod = "GET";
        const url = `/contracts/${domain}/anchoring/${method}/${methodParams ? methodParams : ""}`;

        try {
            let response = await $$.promisify(this.server.makeLocalRequest.bind(this.server))(requestMethod, url);
            if(response) {
                try {
                    response = JSON.parse(response);                    
                } catch (error) {
                    // if the parsing failed, then we will keep the original response as is
                }
            }

            callback(null, response);
        } catch (err) {
            console.error(
                `[Anchoring] Failed to call method '${method}' for contract 'anchoring' for domain '${domain}'`
            );
            callback(err);
        }
    }
}

module.exports = Contract;
