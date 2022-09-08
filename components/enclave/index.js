
const openDSU = require("opendsu");
const { getDefaultEnclave } = require("./commands/DefaultEnclave");
const w3cDID = openDSU.loadAPI("w3cdid");
const path = require("path")

function DefaultEnclave(server) {

    w3cDID.createIdentity("key", undefined, process.env.REMOTE_ENCLAVE_SECRET, (err, didDocument) => {
        didDocument.subscribe(async (err, res) => {
            if (err) {
                console.log(err);
                return
            }

            try {
                const resObj = JSON.parse(res);
                const clientDID = resObj.params.pop();
                // the last parameter is used for stotage folder - where should this be specified?
                const lokiAdaptor = getDefaultEnclave(path.join(getStorageFolder(), clientDID));

                const result = await executeCommand(resObj, lokiAdaptor);
                sendResult(didDocument, result, clientDID);
            }
            catch (err) {
                console.log(err);
            }
        });
    });

    async function executeCommand(resObj, lokiAdaptor) {
        try {
            const command = resObj.commandName;
            const params = resObj.params;
            const result = await $$.promisify(lokiAdaptor[command]).apply(lokiAdaptor, params) ?? {};
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
