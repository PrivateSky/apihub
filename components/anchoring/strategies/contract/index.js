const { getDomainName } = require("../fs/utils");

const FSStrategy = require("../fs");

class Contract {
    constructor(server, domainConfig, anchorId, jsonData) {
        const domainName = getDomainName(anchorId);
        this.commandData = {};
        this.commandData.option = domainConfig.option;
        this.commandData.domain = domainName;
        this.commandData.anchorId = anchorId;
        this.commandData.jsonData = jsonData;
        this.commandData.enableBricksLedger =
            typeof domainConfig.option.enableBricksLedger === "undefined"
                ? false
                : domainConfig.option.enableBricksLedger;

        this.fsStrategy = new FSStrategy(server, domainConfig, anchorId, jsonData);
    }

    createAnchor(callback) {
        this.fsStrategy.createAnchor(callback);
    }

    createNFT(callback) {
        this.fsStrategy.createNFT(callback);
    }

    appendToAnchor(callback) {
        this.fsStrategy.appendToAnchor(callback);
    }

    getAllVersions(alias, callback) {
        this.fsStrategy.getAllVersions(alias, callback);
    }

    getLatestVersion(alias, callback) {
        this.fsStrategy.getLatestVersion(alias, callback);
    }
}

module.exports = Contract;
