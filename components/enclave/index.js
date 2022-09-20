
const openDSU = require("opendsu");
const { getLokiEnclaveFacade } = require("./commands/LokiEnclaveFacade");
const w3cDID = openDSU.loadAPI("w3cdid");
const path = require("path");

function LokiEnclaveFacade(server) {

    let didDocument;

    w3cDID.createIdentity("key", undefined, process.env.REMOTE_ENCLAVE_SECRET, (err, didDoc) => {
        didDocument = didDoc;
        
        didDocument.waitForMessages(async (err, res) => {
            if (err) {
                console.log(err);
                return
            }

            try {
                processCommand(JSON.parse(res));
            }
            catch (err) {
                console.log(err);
            }
        });
    });

    async function processCommand(resObj) {
        const clientDID = resObj.params.pop();
        const lokiAdaptor = getLokiEnclaveFacade(getStorageFolder());

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
            console.log(err);
            return err;
        }
    }

    function sendResult(didDocument, result, clientDID) {
        didDocument.sendMessage(result, clientDID, (err, res) => {
            if (err) {
                console.log(err);
            }
        })
    }

    function getStorageFolder() {
        const enclavePath = server.config.componentsConfig.enclave.storageFolder ?? path.join("external-volume", "enclave");
        return path.join(server.rootFolder, enclavePath);
    }

}

module.exports = {
    LokiEnclaveFacade
};
