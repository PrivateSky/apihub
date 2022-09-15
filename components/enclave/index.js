
const openDSU = require("opendsu");
const { getDefaultEnclave } = require("./commands/DefaultEnclave");
const w3cDID = openDSU.loadAPI("w3cdid");
const path = require("path");

function DefaultEnclave(server) {

    const TIME_WINDOW = 500;
    let commandsList = [];
    let didDocument;

    w3cDID.createIdentity("key", undefined, process.env.REMOTE_ENCLAVE_SECRET, (err, didDoc) => {

        startProcessingInterval();
        didDocument = didDoc;
        didDocument.waitForMessages(async (err, res) => {
            if (err) {
                console.log(err);
                return
            }

            try {
                commandsList.push(JSON.parse(res));
            }
            catch (err) {
                console.log(err);
            }
        });
    });

    function startProcessingInterval() {
        setInterval(async () => {
            let copy = [...commandsList]
            commandsList = [];

            copy.sort((c1, c2) => c2.timestamp - c1.timestamp);
            while (copy.length !== 0) {
                await processCommand(copy.pop());
            }
        }, TIME_WINDOW)
    }

    async function processCommand(resObj) {
        const clientDID = resObj.params.pop();
        const lokiAdaptor = getDefaultEnclave(getStorageFolder());

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
    DefaultEnclave
};
