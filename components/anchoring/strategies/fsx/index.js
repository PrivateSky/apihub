
const openDSU = require("opendsu");

class FSX{
    constructor(server, domainConfig, anchorId, jsonData) {
        this.commandData = {};
        this.commandData.option = domainConfig.option;
        this.commandData.anchorId = anchorId;
        this.commandData.jsonData = jsonData || {};
        const FilePersistence = require('./filePersistence').FilePersistenceStrategy;
        const fps = new FilePersistence(server.rootFolder,domainConfig.option.path);
        this.anchoringBehaviour = openDSU.loadApi("anchoring").getAnchoringBehaviour(fps);
    }

    createAnchor(callback){
        console.log('FSX create anchor');
        this.anchoringBehaviour.createAnchor(this.commandData.anchorId, this.commandData.jsonData.hashLinkSSI, callback);
    }

    appendToAnchor(callback){
        console.log('FSX append anchor');
        this.anchoringBehaviour.appendAnchor(this.commandData.anchorId, this.commandData.jsonData.hashLinkSSI, callback);
    }

    getAllVersions(callback){
        console.log('FSX get all versions');
        this.anchoringBehaviour.getAllVersions(this.commandData.anchorId, callback);
    }

    getLastVersion(callback){
        console.log('FSX get last version');
        this.anchoringBehaviour.getLastVersion(this.commandData.anchorId, callback);
    }
}

module.exports = FSX;
