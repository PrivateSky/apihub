
const openDSU = require("opendsu");
const { getLokiEnclaveFacade } = require("./commands/LokiEnclaveFacade");
const w3cDID = openDSU.loadAPI("w3cdid");
const fs = require("fs");
const sc = openDSU.loadAPI("crypto");
const config = require("../../config");

const syndicate = require('syndicate');
const path = require("swarmutils").path;
const worker_threads = 'worker_threads';
const { isMainThread } = require(worker_threads);

function LokiEnclaveFacade(server) {
    const logger = $$.getLogger("LokiEnclaveFacade", "apihub/enclave");
    let bootPath;

    if (isMainThread) {

        bootPath = config.getConfig("componentsConfig", "enclave", "dsuBootPath");

        if (bootPath.startsWith(".")) {
            bootPath = path.resolve(require("path").join(process.env.PSK_ROOT_INSTALATION_FOLDER, bootPath));
        }

        logger.info(`Using boot script for worker: ${bootPath}`);

        //cacheContainerPath = require("path").join(server.rootFolder, config.getConfig("externalStorage"), `cache`);

        const workerPool = syndicate.createWorkerPool({
            bootScript: bootPath
        });

        bootEnclaves();

        async function createEnclave(req, res) {
            const adminDID = req.params.adminDID;
            const key = adminDID.split(":")[2].substring(0, 6);
            const didDocument = await $$.promisify(w3cDID.createIdentity)("key", undefined, key);

            createFolderForDID(didDocument.getIdentifier(), (err, didDir) => {
                if (err) {
                    res.end(err);
                }
                // initEnclave(didDocument.getIdentifier(), didDir);
                workerPool.addTask({
                    didIdentifier: didDocument.getIdentifier(),
                    didDirectory: didDir
                }, (err) => {
                    if (err) {
                        res.end(err);
                    }
                    res.end(didDocument.getIdentifier())
                });
            })

        }

        function bootEnclaves() {
            const storageFolder = getStorageFolder();

            if (!fs.existsSync(storageFolder)) {
                w3cDID.createIdentity("key", undefined, process.env.REMOTE_ENCLAVE_SECRET, async (err, didDoc) => {
                    if (err) {
                        logger.error(err);
                        return err;
                    }
                    createFolderForDID(didDoc.getIdentifier(), (err, didDir) => {
                        if (err) {
                            logger.error(err);
                            return err;
                        }
                        //initEnclave(didDoc.getIdentifier(), didDir);
                        workerPool.addTask({
                            didIdentifier: didDoc.getIdentifier(),
                            didDirectory: didDir
                        }, (err) => {
                            if (err) {
                                logger.error(err);
                            }
                        });
                    })
                });
                return;
            }

            getDirectories(storageFolder, (err, dirs) => {
                if (err) {
                    logger.error(err);
                    return err;
                }
                dirs.forEach(async (dir) => {
                    const did = sc.decodeBase58(dir);
                    didDocument = await $$.promisify(w3cDID.resolveDID)(did);
                    //initEnclave(didDocument.getIdentifier(), path.join(storageFolder, dir));
                    workerPool.addTask({
                        didIdentifier: didDocument.getIdentifier(),
                        didDirectory: require("path").join(storageFolder, dir)
                    }, (err) => {
                        if (err) {
                            logger.error(err);
                        }
                    });
                })
            })
        }

        function createFolderForDID(did, callback) {
            const base58DID = sc.encodeBase58(did).substring(0, 6);
            const didDir = require("path").join(getStorageFolder(), base58DID);

            fs.mkdir(didDir, { recursive: true }, (err) => {
                if (err) {
                    return callback(err);
                }
                return callback(undefined, didDir);
            });
        }

        function getStorageFolder() {
            const enclavePath = server.config.componentsConfig.enclave.storageFolder ?? require("path").join("external-volume", "enclave");
            return require("path").join(server.rootFolder, enclavePath);
        }

        function getDirectories(source, callback) {
            readdir(source, { withFileTypes: true }, (err, files) => {
                if (err) {
                    callback(err)
                } else {
                    callback(
                        files
                            .filter(dirent => dirent.isDirectory())
                            .map(dirent => dirent.name)
                    )
                }
            })
        }

        server.use("/enclave/*", require("./../../utils/middlewares/index").requestBodyJSONMiddleware);

        server.post('/enclave/create-enclave/:adminDID', createEnclave)
    }
    else {
        const { parentPort } = require(worker_threads);
        parentPort.on('message', (msg) => {
            const { didIdentifier, didDirectory } = msg;
            initEnclave(didIdentifier, didDirectory);
        });
        parentPort.postMessage('ready');
    }

    function initEnclave(didIdentifier, didDir) {

        w3cDID.resolveDID(didIdentifier, (err, didDocument) => {
            if (err) {
                logger.error(err);
                return
            }
            didDocument.waitForMessages(async (err, res) => {
                if (err) {
                    logger.error(err);
                    return
                }

                try {
                    processCommand(didDocument, JSON.parse(res));
                }
                catch (err) {
                    logger.error(err);
                }
            });
        });

        async function processCommand(didDocument, resObj) {
            const clientDID = resObj.params.pop();
            const lokiAdaptor = getLokiEnclaveFacade(didDir);

            const result = await executeCommand(resObj, lokiAdaptor);
            sendResult(didDocument, result, clientDID);
        }

        async function executeCommand(resObj, lokiAdaptor) {
            try {
                const command = resObj.commandName;
                const params = resObj.params;
                let dbResult = await $$.promisify(lokiAdaptor[command]).apply(lokiAdaptor, params) ?? {};
                return JSON.stringify({ "commandResult": dbResult, "commandID": resObj.commandID })
            }
            catch (err) {
                logger.error(err);
                return err;
            }
        }

        function sendResult(didDocument, result, clientDID) {
            didDocument.sendMessage(result, clientDID, (err, res) => {
                if (err) {
                    logger.error(err);
                }
            })
        }
    }

}



module.exports = {
    LokiEnclaveFacade
};
