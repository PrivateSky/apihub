
const openDSU = require("opendsu");
const { getLokiEnclaveFacade } = require("./commands/LokiEnclaveFacade");
const w3cDID = openDSU.loadAPI("w3cdid");
const path = require("path");
const fs = require("fs");
const sc = openDSU.loadAPI("crypto");

function LokiEnclaveFacade(server) {
    const logger = $$.getLogger("LokiEnclaveFacade", "apihub/enclave");

    bootEnclaves();

    async function createEnclave(req, res) {
        const adminDID = req.params.adminDID;
        const key = adminDID.split(":")[2].substring(0, 6);
        const didDocument = await $$.promisify(w3cDID.createIdentity)("key", undefined, key);
        createFolderForDID(didDocument.getIdentifier(), (err, didDir) => {
            if (err) {
                res.end(err);
            }
            initEnclave(logger, didDocument, didDir);
            res.end(didDocument.getIdentifier())
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
                    initEnclave(logger, didDoc, didDir);
                })
            });
            return;
        }

        getDirectories(storageFolder, (err, dirs)=>{
            if (err) {
                logger.error(err);
                return err;
            }
            dirs.forEach(async (dir) => {
                const did = sc.decodeBase58(dir);
                didDocument = await $$.promisify(w3cDID.resolveDID)(did);
                initEnclave(server, logger, didDocument, path.join(storageFolder, dir));
            })
        })
    }

    function createFolderForDID(did, callback) {
        const base58DID = sc.encodeBase58(did).substring(0, 6);
        const didDir = path.join(getStorageFolder(), base58DID);

        fs.mkdir(didDir, { recursive: true }, (err) => {
            if (err) {
                return callback(err);
            }
            return callback(undefined, didDir);
        });
    }

    function getStorageFolder() {
        const enclavePath = server.config.componentsConfig.enclave.storageFolder ?? path.join("external-volume", "enclave");
        return path.join(server.rootFolder, enclavePath);
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

function initEnclave(logger, didDocument, didDir) {

    didDocument.waitForMessages(async (err, res) => {
        if (err) {
            logger.error(err);
            return
        }

        try {
            processCommand(JSON.parse(res));
        }
        catch (err) {
            logger.error(err);
        }
    });


    async function processCommand(resObj) {
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

module.exports = {
    LokiEnclaveFacade
};

