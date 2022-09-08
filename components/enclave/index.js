
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
                const lokiAdaptor = getDefaultEnclave(getStorageFolder());

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
        const enclavePath = server.config.componentsConfig.enclave.storageFolder ?? path.join("external-volume", "enclave");
        return path.join(server.rootFolder, enclavePath);
    }

}

module.exports = {
    DefaultEnclave
};
