const syndicate = require("syndicate");

const dsuWorkers = {};

function getNodeWorkerBootScript() {
    const openDSUScriptPath = global.bundlePaths.openDSU.replace(/\\/g, "\\\\").replace(".js", "");
    return `
        require("${openDSUScriptPath}");
        (${require("./worker-script").toString()})();
    `;
}

async function handleCreateWallet(request, response) {
    try {
        const { domain, userId } = request.params;
        const keySSISpace = require("opendsu").loadApi("keyssi");
        const resolver = require("opendsu").loadApi("resolver");

        const crypto = require("pskcrypto");
        const credential = crypto.randomBytes(64).toString("hex");

        const walletSSI = keySSISpace.createTemplateWalletSSI(domain, credential);
        const seedSSI = await $$.promisify(keySSISpace.createSeedSSI)(domain);

        console.log(`[Stream] Creating wallet ${walletSSI.getIdentifier()} for user ${userId}...`);
        const walletDSU = await $$.promisify(resolver.createDSUForExistingSSI)(walletSSI, { dsuTypeSSI: seedSSI });

        const writableDSU = walletDSU.getWritableDSU();

        const enclaveKeySSIObject = await $$.promisify(resolver.createSeedDSU)(domain);
        const enclaveKeySSI = await $$.promisify(enclaveKeySSIObject.getKeySSIAsString)();

        const sharedEnclaveKeySSIObject = await $$.promisify(resolver.createSeedDSU)(domain);
        const sharedEnclaveKeySSI = await $$.promisify(sharedEnclaveKeySSIObject.getKeySSIAsString)();

        const constants = require("opendsu").constants;
        const environmentConfig = {
            vaultDomain: domain,
            didDomain: domain,
            enclaveType: constants.ENCLAVE_TYPES.WALLET_DB_ENCLAVE,
            enclaveKeySSI,
            sharedEnclaveType: constants.ENCLAVE_TYPES.WALLET_DB_ENCLAVE,
            sharedEnclaveKeySSI,
        };

        console.log(`[Stream] Settings config for wallet ${walletSSI.getIdentifier()}`, environmentConfig);
        await $$.promisify(writableDSU.writeFile)("/environment.json", JSON.stringify(environmentConfig));

        await $$.promisify(writableDSU.writeFile)("/metadata.json", JSON.stringify({ userId }));

        response.statusCode = 200;
        return response.end(walletSSI.getIdentifier());
    } catch (error) {
        console.log("[Stream] Error", error);
        response.statusCode = 500;
        return response.end(error);
    }
}

async function handleStreamRequest(request, response) {
    const { keySSI } = request.params;
    let requestedPath = request.url.substr(request.url.indexOf(keySSI) + keySSI.length);
    if (!requestedPath) {
        requestedPath = "/";
    }
    if (!requestedPath.startsWith("/")) {
        requestedPath = `/${requestedPath}`;
    }

    let range = request.headers.range;
    if (!range) {
        response.statusCode = 400;
        return response.end("Requires Range header");
    }

    let dsuWorker = dsuWorkers[keySSI];
    if (!dsuWorker) {
        dsuWorker = syndicate.createWorkerPool({
            bootScript: getNodeWorkerBootScript(),
            maximumNumberOfWorkers: 1,
            workerOptions: {
                eval: true,
                workerData: {
                    keySSI,
                },
            },
        });
        dsuWorkers[keySSI] = dsuWorker;
    }

    const sendTaskToWorker = (task, callback) => {
        dsuWorker.addTask(task, (err, message) => {
            if (err) {
                return callback(err);
            }

            let { error, result } = typeof Event !== "undefined" && message instanceof Event ? message.data : message;

            if (error) {
                return callback(error);
            }

            if (result && result.buffer && result.buffer instanceof Uint8Array) {
                result.buffer = $$.Buffer.from(result.buffer);
            }

            callback(error, result);
        });
    };

    const task = {
        requestedPath,
        range,
    };

    try {
        const taskResult = await $$.promisify(sendTaskToWorker)(task);
        response.writeHead(206, taskResult.headers);
        response.end(taskResult.buffer);
    } catch (error) {
        console.log("[Stream] error", error);
        response.statusCode = 500;
        return response.end(error);
    }
}

module.exports = {
    handleCreateWallet,
    handleStreamRequest,
};
