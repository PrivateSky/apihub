const {getEthereumSyncServiceSingleton} = require("./ehereumSyncService");
const LOG_IDENTIFIER = "[OBA]";

function OBA(server, domainConfig, anchorId, anchorValue, ...args) {
    let {FS, ETH} = require("../index");
    const fsHandler = new FS(server, domainConfig, anchorId, anchorValue, ...args);
    const ethHandler = new ETH(server, domainConfig, anchorId, anchorValue, ...args);
    const ethSyncService = getEthereumSyncServiceSingleton(server);

    ethSyncService.synchronize();
    this.createAnchor = function (callback) {
        console.log("Create anchor", anchorId, anchorValue);
        fsHandler.createAnchor((err, res) => {
            if (err) {
                return callback(err);
            }
            console.log(`${LOG_IDENTIFIER} optimistic create anchor ended with success.`);

            ethSyncService.storeAnchor("createAnchor", anchorId, anchorValue, domainConfig,(err) => {
                if (err) {
                    console.log(`${LOG_IDENTIFIER} failed to store anchor ${fsHandler.commandData.anchorId} in db.`);
                    return;
                }

                console.log(`${LOG_IDENTIFIER} anchor ${fsHandler.commandData.anchorId} stored in db successfully.`);
                return callback(undefined, res);
            })
        });
    }

    this.appendAnchor = function (callback) {
        fsHandler.appendAnchor((err, res) => {
            if (err) {
                return callback(err);
            }
            console.log(`${LOG_IDENTIFIER} optimistic append anchor ended with success.`);
            ethSyncService.storeAnchor("appendAnchor", anchorId, anchorValue, domainConfig, (err) => {
                if (err) {
                    console.log(`${LOG_IDENTIFIER} failed to store anchor ${fsHandler.commandData.anchorId} in db.`);
                    return;
                }

                console.log(`${LOG_IDENTIFIER} anchor ${fsHandler.commandData.anchorId} stored in db successfully.`);
                return callback(undefined, res);

            })
        });
    }

    function readAllVersionsFromBlockchain(callback) {
        console.log(`${LOG_IDENTIFIER} preparing to read info about anchorId ${fsHandler.commandData.anchorId} from the blockchain...`);
        ethHandler.getAllVersions((err, anchorVersions) => {
            if (err) {
                console.log(`${LOG_IDENTIFIER} anchorId ${fsHandler.commandData.anchorId} syncing blockchain failed. ${err}`);
                return callback(err);
            }

            let history = "";
            for (let i = 0; i < anchorVersions.length; i++) {
                history += anchorVersions[i];
                if (i + 1 < anchorVersions.length) {
                    history += require("os").EOL;
                }
            }

            if (history === "") {
                console.log(`${LOG_IDENTIFIER} anchorId ${fsHandler.commandData.anchorId} synced but no history found.`);
                //if we don't retrieve info from blockchain we exit
                return callback(undefined, anchorVersions);
            }

            console.log(`${LOG_IDENTIFIER} found info about anchorId ${fsHandler.commandData.anchorId} in blockchain.`);

            //storing locally the history of the anchorId read from the blockchain
            fsHandler.fps.createAnchor(anchorId, history, (err) => {
                if (err) {
                    console.log(`${LOG_IDENTIFIER} failed to store info about anchorId ${fsHandler.commandData.anchorId} on local because of ${err}`);
                    return callback(err);
                }
                console.log(`${LOG_IDENTIFIER} anchorId ${fsHandler.commandData.anchorId} fully synced.`);
                //even if we read all the versions of anchorId we return only the last one
                return callback(undefined, anchorVersions);
            });
        });
    }

    this.getAllVersions = function (callback) {
        fsHandler.getAllVersions((error, res) => {
            if (error || !res) {
                return readAllVersionsFromBlockchain((err, allVersions) => {
                    if (err) {
                        //we return the error from FS because we were not able to read any from blockchain.
                        return callback(error);
                    }
                    return callback(undefined, allVersions);
                });
            }
            return callback(undefined, res);
        });
    }

    this.getLastVersion = function (callback) {
        fsHandler.getLastVersion((error, res) => {
            if (error || !res) {
                return readAllVersionsFromBlockchain((err, allVersions) => {
                    if (err) {
                        //we return the error from FS because we were not able to read any from blockchain.
                        return callback(error);
                    }
                    return callback(undefined, allVersions.pop());
                });
            }
            return callback(undefined, res);
        });
    }
}

module.exports = OBA;
