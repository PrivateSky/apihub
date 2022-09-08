
const openDSU = require("opendsu");
const w3cDID = openDSU.loadAPI("w3cdid");
const LokiAdaptor = require("default-enclave");

function DefaultEnclave(server) {

    const storageFolder = require("path").join(getStorageFolder(), "enclave");
    const lokiAdaptor = new LokiAdaptor(storageFolder);

    w3cDID.createIdentity("key", undefined, process.env.REMOTE_ENCLAVE_SECRET, (err, didDocument) => {
        didDocument.subscribe(async (err, res) => {
            if (err) {
                console.log(err);
                return
            }

            try {
                const resObj = JSON.parse(res);
                const clientDID = resObj.params.pop();
                const result = await executeCommand(resObj);
                sendResult(didDocument, result, clientDID);
            }
            catch (err) {
                console.log(err);
            }
        });
    });

    async function executeCommand(resObj) {
        try {
            const command = resObj.commandName;
            const params = resObj.params;
            const result = await $$.promisify(lokiAdaptor[command]).apply(lokiAdaptor, params);
            return JSON.stringify(result);
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
        const config = server.config;
        const storage = require("path").join(server.rootFolder, config.componentsConfig.enclave.storageFolder);
        return storage;
    }


}

module.exports = {
    DefaultEnclave
};
