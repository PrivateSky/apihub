const LOG_IDENTIFIER = "[OBA]";
function OBA(...args) {

    let {FS, ETH} = require("../index");
    const fsHandler = new FS(...args);
    const ethHandler = new ETH(...args);

    this.createAnchor = function (callback) {
        fsHandler.createAnchor((err, res) => {
            if (err) {
                return callback(err);
            }
            console.log(`${LOG_IDENTIFIER} optimistic create anchor ended with success.`);
            ethHandler.createAnchor((err, res) => {
                //TODO: handler err and res
                if(err && !res){
                    console.log(`${LOG_IDENTIFIER} create for anchorId ${fsHandler.commandData.anchorId} will be synced later.`);
                    return;
                }
                console.log(`${LOG_IDENTIFIER} create for anchorId ${fsHandler.commandData.anchorId} synced with success.`);
            });
            return callback(undefined, res);
        });
    }

    this.appendAnchor = function (callback) {
        fsHandler.appendAnchor((err, res) => {
            if (err) {
                return callback(err);
            }
            console.log(`${LOG_IDENTIFIER} optimistic append anchor ended with success.`);
            ethHandler.appendAnchor((err, res) => {
                //TODO: handler err and res
                if(err && !res){
                    console.log(`${LOG_IDENTIFIER} update of anchorId ${fsHandler.commandData.anchorId} will be synced later.`);
                    return;
                }
                console.log(`${LOG_IDENTIFIER} update of anchorId ${fsHandler.commandData.anchorId} synced with success.`);
            });
            return callback(undefined, res);
        });
    }

    this.getAllVersions = function (callback) {
        fsHandler.getAllVersions((err, res) => {
            if (err) {
                return callback(err);
            }
            return callback(undefined, res);
        });
    }

    this.getLastVersion = function (callback) {
        fsHandler.getLastVersion((err, res) => {
            if (err) {
                return callback(err);
            }
            return callback(undefined, res);
        });
    }
}

module.exports = OBA;
