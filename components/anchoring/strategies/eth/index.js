const { sendToBlockChain, readFromBlockChain } = require("./utils");

class ETH {
    constructor(server, domainConfig, anchorId, jsonData) {
        this.commandData = {};
        this.commandData.anchorId = anchorId;
        this.commandData.jsonData = jsonData;
        this.commandData.option = domainConfig.option;
        this.commandData.domainConfig = domainConfig;
    }

    createAnchor(callback) {
        sendToBlockChain(this.commandData, callback);
    }

    createNFT(callback) {
        sendToBlockChain(this.commandData, callback);
    }

    appendToAnchor(callback) {
        sendToBlockChain(this.commandData, callback);
    }

    getAllVersions(callback) {
        readFromBlockChain(this.commandData, callback);
    }

    getLatestVersion(callback) {
        this.getAllVersions((err, results) => {
            if (err) {
                return callback(err);
            }

            const lastVersion = results && results.length ? results[results.length - 1] : null;
            callback(null, lastVersion);
        });
    }
}

module.exports = ETH;
