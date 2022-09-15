const {ALIAS_SYNC_ERR_CODE} = require("../../utils");
const {getLokiEnclaveFacade} = require("./lokiEnclaveFacadeSingleton");

function EthereumSyncService(server) {
    const path = require("path");
    const DB_STORAGE_FOLDER = path.join(server.rootFolder, "external-volume", "oba");
    let lokiEnclaveFacade = getLokiEnclaveFacade(DB_STORAGE_FOLDER);
    const ANCHORS_TABLE_NAME = "anchors_table";
    const ERROR_LOGS_TABLE = "errors_table";
    let syncInProgress = false;
    const {ETH} = require("../index");

    function sendAnchorToBlockchain(anchorHash, anchorObj, taskCounter) {
        const ethHandler = new ETH(server, anchorObj.domainConfig, anchorObj.anchorId, anchorObj.anchorValue);
        ethHandler[anchorObj.anchorUpdateOperation]((err) => {
            if (err) {
                if (err.code === ALIAS_SYNC_ERR_CODE) {
                    lokiEnclaveFacade.deleteObjectFromQueue(undefined, ANCHORS_TABLE_NAME, anchorHash, () => {
                        logError(err, anchorObj, () => {
                            taskCounter.decrement();
                        });
                    });

                    return;
                }

                logError(err, anchorObj, () => {
                    taskCounter.decrement();
                })
                return;
            }

            lokiEnclaveFacade.deleteObjectFromQueue(undefined, ANCHORS_TABLE_NAME, anchorHash, () => {
                taskCounter.decrement();
            });
        });

    }

    function processPendingAnchors(callback) {
        const TaskCounter = require("swarmutils").TaskCounter;
        const taskCounter = new TaskCounter(() => {
            return callback(undefined);
        })

        lokiEnclaveFacade.listQueue(undefined, ANCHORS_TABLE_NAME, "asc", 100, (err, anchorHashes) => {
            if (err) {
                return callback(err);
            }

            if (typeof anchorHashes === "undefined" || anchorHashes.length === 0) {
                callback();
                return;
            }

            taskCounter.increment(anchorHashes.length);
            anchorHashes.forEach(anchorHash => {
                lokiEnclaveFacade.getObjectFromQueue(undefined, ANCHORS_TABLE_NAME, anchorHash, (err, anchorObj) => {
                    if (err) {
                        taskCounter.decrement();
                        return;
                    }

                    sendAnchorToBlockchain(anchorHash, anchorObj, taskCounter, callback);
                })
            });
        })
    }

    function logError(err, anchorData, callback) {
        const timestamp = Date.now();
        lokiEnclaveFacade.insertRecord(undefined, ERROR_LOGS_TABLE, timestamp, {anchorData, err, timestamp}, callback)
    }

    this.storeAnchor = (anchorUpdateOperation, anchorId, anchorValue, domainConfig, callback) => {
        lokiEnclaveFacade.addInQueue(undefined, ANCHORS_TABLE_NAME, {
            anchorId,
            anchorValue,
            anchorUpdateOperation,
            domainConfig
        }, callback);
    }

    function resendAnchorsToBlockchain() {
        processPendingAnchors( () => {
            setTimeout(resendAnchorsToBlockchain, 10000);
        });
    }

    this.synchronize = () => {
        if (!syncInProgress) {
            resendAnchorsToBlockchain();
            syncInProgress = true;
        }
    };
}

const getEthereumSyncServiceSingleton = (server) => {
    if (typeof $$.ethereumSyncService === "undefined") {
        $$.ethereumSyncService = new EthereumSyncService(server);
    }

    return $$.ethereumSyncService;
}
module.exports = {
    getEthereumSyncServiceSingleton
}