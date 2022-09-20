const {ALIAS_SYNC_ERR_CODE, ANCHOR_ALREADY_EXISTS_ERR_CODE} = require("../../utils");
const {getLokiEnclaveFacade} = require("./lokiEnclaveFacadeSingleton");
const path = require("path");

function EthereumSyncService(server, config) {
    const defaultConfig = {
        scheduleInterval: 10000,
        sendInterval: 17000,
        burstSize: 100,
        maxNumberOfRetries: 100
    }
    Object.assign(defaultConfig, config);
    config = defaultConfig;

    const BASE_FOLDER = path.join(server.rootFolder, "external-volume", "oba");
    const DB_STORAGE_FILE = path.join(BASE_FOLDER, "pendingAnchors");
    const CRITICAL_LOG_FILE = path.join(BASE_FOLDER, "failedAnchors");
    const logger = $$.getLogger("EthereumSyncService", "OBA", CRITICAL_LOG_FILE);

    const openDSU = require("opendsu");
    const utils = openDSU.loadAPI("utils");
    const TaskCounter = require("swarmutils").TaskCounter;
    let lokiEnclaveFacade = getLokiEnclaveFacade(DB_STORAGE_FILE);
    const ANCHORS_TABLE_NAME = "anchors_table";
    const LOG_IDENTIFIER = "[OBA - ETH_SYNC]";
    let syncInProgress = false;
    const {ETH} = require("../index");

    const init = () => {
        syncInProgress = false;
        const taskCounter = new TaskCounter(() => {
            this.finishInitialisation();
        })

        lokiEnclaveFacade.filter(undefined, ANCHORS_TABLE_NAME, (err, anchors) => {
            if (err) {
                this.finishInitialisation();
                return;
            }

            if (typeof anchors === "undefined" || anchors.length === 0) {
                return this.finishInitialisation();
            }

            taskCounter.increment(anchors.length);
            anchors.forEach(anchor => {
                anchor.scheduled = null;
                anchor.tc = 1;
                lokiEnclaveFacade.updateRecord(undefined, ANCHORS_TABLE_NAME, anchor.pk, anchor, err => {
                    if (err) {
                        logger.error(`Failed to update anchor ${anchor.pk} in db: ${err}`);
                    }

                    taskCounter.decrement();
                })
            })
        })
    }

    function sendAnchorToBlockchain(anchor) {
        const ethHandler = new ETH(server, anchor.domainConfig, anchor.anchorId, anchor.anchorValue);
        ethHandler[anchor.anchorUpdateOperation]((err, transactionHash) => {
            if (err) {
                if (err.code === ANCHOR_ALREADY_EXISTS_ERR_CODE || err.code === ALIAS_SYNC_ERR_CODE) {
                    logger.critical(`Failed to anchor value ${anchor.anchorValue} for ${anchor.anchorId}: Anchoring conflict.`, err => {
                        if (err) {
                            logger.error(`Failed to write log to file ${CRITICAL_LOG_FILE}`, err);
                        }

                        lokiEnclaveFacade.deleteRecord(undefined, ANCHORS_TABLE_NAME, anchor.pk, err => {
                            if (err) {
                                logger.error(`Failed to delete anchor ${anchor.anchorId} from db: ${err}`);
                            }
                        });
                    });
                    return;
                }
                anchor.scheduled = null;
                anchor.tc++;
                if (anchor.tc === config.maxNumberOfRetries) {
                    logger.critical(`Failed to anchor value ${anchor.anchorValue} for ${anchor.anchorId}. Too many retries`, err => {
                        if (err) {
                            logger.error(`Failed to write log to file ${CRITICAL_LOG_FILE}`, err);
                        }
                    });
                }
                lokiEnclaveFacade.updateRecord(undefined, ANCHORS_TABLE_NAME, anchor.pk, anchor, err => {
                    if (err) {
                        logger.log(`Failed to update anchor ${anchor.pk}: ${err}`);
                    }
                });
                return;
            }


            logger.info(`Version anchor ${anchor.anchorValue} for anchor ${anchor.anchorId} has been successfully stored in blockchain: transaction ${transactionHash}`);
            lokiEnclaveFacade.deleteRecord(undefined, ANCHORS_TABLE_NAME, anchor.pk, err => {
                if (err) {
                    logger.log(`${LOG_IDENTIFIER}: Failed to delete anchor ${anchor.anchorId} from db: ${err}`);
                }
            })
        })
    }

    this.storeAnchor = (anchorUpdateOperation, anchorId, anchorValue, domainConfig, callback) => {
        lokiEnclaveFacade.addInQueue(undefined, ANCHORS_TABLE_NAME, {
            anchorId,
            anchorValue,
            anchorUpdateOperation,
            domainConfig,
            scheduled: null,
            tc: 1
        }, callback);
    }

    const scheduleAnchors = () => {
        lokiEnclaveFacade.filter(undefined, ANCHORS_TABLE_NAME, ["scheduled == null"], "asc", (err, anchors) => {
            if (err) {
                logger.error(`Failed to get anchors from db: ${err}`);
                return;
            }
            anchors.forEach(anchor => {
                anchor.scheduled = Date.now() + (anchor.tc > 100 ? 100 : anchor.tc) * config.scheduleInterval;
                lokiEnclaveFacade.updateRecord(undefined, ANCHORS_TABLE_NAME, anchor.pk, anchor, err => {
                    if (err) {
                        logger.error(`Failed to update anchor ${anchor.pk} in db: ${err}`);
                    }
                })
            })
        })
    }

    const sendAnchorsToBlockchain = () => {
        lokiEnclaveFacade.filter(undefined, ANCHORS_TABLE_NAME, ["scheduled != null", "scheduled != sent", `scheduled < ${Date.now()}`], "asc", config.burstSize, (err, anchors) => {
            if (err) {
                logger.error(`${LOG_IDENTIFIER}: Failed to get anchors from db: ${err}`);
                return;
            }

            anchors.forEach(anchor => {
                anchor.scheduled = "sent";
                lokiEnclaveFacade.updateRecord(undefined, ANCHORS_TABLE_NAME, anchor.pk, anchor, err => {
                    if (err) {
                        logger.error(`Failed to update anchor ${anchor.pk} in db: ${err}`);
                        return;
                    }

                    sendAnchorToBlockchain(anchor);
                })
            })
        })
    }

    this.synchronize = () => {
        if (!syncInProgress) {
            setInterval(scheduleAnchors, config.scheduleInterval);
            setInterval(sendAnchorsToBlockchain, config.sendInterval);
            syncInProgress = true;
        }
    };

    utils.bindAutoPendingFunctions(this);
    init();
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