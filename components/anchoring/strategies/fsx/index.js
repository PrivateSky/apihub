
const openDSU = require("opendsu");

class FSX{
    constructor(server, domainConfig, anchorId, anchorValue, jsonData) {
        this.commandData = {};
        this.commandData.option = domainConfig.option;
        this.commandData.anchorId = anchorId;
        this.commandData.anchorValue = anchorValue;
        this.commandData.jsonData = jsonData || {};
        const FilePersistence = require('./filePersistence').FilePersistenceStrategy;
        const fps = new FilePersistence(server.rootFolder,domainConfig.option.path);
        this.anchoringBehaviour = openDSU.loadApi("anchoring").getAnchoringBehaviour(fps);
    }

    createAnchor(callback){
        this.anchoringBehaviour.createAnchor(this.commandData.anchorId, this.commandData.anchorValue, callback);
    }

    appendAnchor(callback){
        this.anchoringBehaviour.appendAnchor(this.commandData.anchorId, this.commandData.anchorValue, callback);
    }

    getAllVersions(callback){
        this.anchoringBehaviour.getAllVersions(this.commandData.anchorId, (err, anchorValues)=>{
            if (err) {
                return callback(err);
            }
            if (anchorValues.length === 0) {
                return callback(anchorValues);
            }

            callback(undefined, anchorValues.map(el => el.getIdentifier()));
        });
    }

    getLastVersion(callback){
        this.anchoringBehaviour.getLastVersion(this.commandData.anchorId, (err, anchorValue)=>{
            if (err) {
                return callback(err);
            }

            if (anchorValue) {
                return callback(undefined, anchorValue.getIdentifier());
            }

            callback();
        });
    }
}

module.exports = FSX;
