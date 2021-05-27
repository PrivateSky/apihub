function boot(domain, domainConfig, rootFolder) {
    const worker_threads = "worker_threads";
    const { parentPort } = require(worker_threads);

    process.on("uncaughtException", (err) => {
        console.error("[contract-worker] unchaughtException inside worker", err);
        setTimeout(() => {
            process.exit(1);
        }, 100);
    });

    const BootEngine = require("./BootEngine.js");

    const booter = new BootEngine(domain, domainConfig, rootFolder);

    booter.boot((error, contractHandlers) => {
        if (error) {
            parentPort.postMessage({ error });
            throw error;
        }

        // keep for each contract the describeMethods method results in order to validate the method calls
        const allContractsMethodsInfo = {};
        Object.keys(contractHandlers).forEach((contractName) => {
            const contract = contractHandlers[contractName];
            allContractsMethodsInfo[contractName] = contract.describeMethods ? contract.describeMethods() : null;
        });

        const handleMessage = async (message, callback) => {
            if (!message) {
                return callback("[contract-worker] Received empty message!");
            }

            console.log("[contract-worker] Received message: ", message);

            const { contract: contractName, method, nonce, signerDID: signerDIDIdentifier } = message;
            const params = message.params || [];
            const contractHandler = contractHandlers[contractName];
            if (!contractHandler) {
                return callback(`[contract-worker] Unkwnown contract '${contractName}'`);
            }

            if (!contractHandler[method]) {
                return callback(`[contract-worker] Unkwnown contract method '${method}' for contract '${contractName}'`);
            }

            const contractMethodsInfo = allContractsMethodsInfo[contractName];
            if (!contractMethodsInfo) {
                return callback(`[contract-worker] Missing describeMethods for contract '${contractName}'`);
            }

            const isOnlyInternCallsAllowedForMethod = contractMethodsInfo.intern && contractMethodsInfo.intern.includes(method);
            if (isOnlyInternCallsAllowedForMethod) {
                // intern methods cannot be called outside the worker
                return callback(
                    `[contract-worker] Only intern calls are allowed for contract '${contractName}' and method '${method}'`
                );
            }

            const isPublicCallAllowedForMethod = contractMethodsInfo.public && contractMethodsInfo.public.includes(method);
            if (isPublicCallAllowedForMethod) {
                // public method can be called directly without signature restrictions
                return contractHandler[method].call(contractHandler, ...params, callback);
            }

            const isRequireNonceCallAllowedForMethod =
                contractMethodsInfo.requireNonce && contractMethodsInfo.requireNonce.includes(method);
            if (!isRequireNonceCallAllowedForMethod) {
                // if we arrive at this point, then the requested method is not configured inside describeMethods
                // so we block it
                return callback(
                    `[contract-worker] Unconfigured describeMethods for contract '${contractName}' and method '${method}'`
                );
            }

            // for requireNonce methods we need to validate the nonce in order to run it
            if (!nonce || !signerDIDIdentifier) {
                return callback(`[contract-worker] missing inputs required for signature validation`);
            }

            try {
                // validate nonce
                const consensusHandler = contractHandlers.consensus;
                if (!consensusHandler) {
                    return callback(`[contract-worker] missing consensus contract!`);
                }

                const isValidNonce = await $$.promisify(consensusHandler.validateNonce)(signerDIDIdentifier, nonce);
                if (!isValidNonce) {
                    return callback(`[contract-worker] invalid nonce ${nonce} specified`);
                }

                // run consensus
                const command = {
                    contract: contractName,
                    method,
                    params,
                };
                const result = await $$.promisify(consensusHandler.proposeCommand)(command);
                if (result) {
                    return contractHandler[method].call(contractHandler, ...params, callback);
                }

                return callback("[contract-worker] consensus wasn't reached");
            } catch (error) {
                callback(error);
            }
        };

        parentPort.on("message", (message) => {
            handleMessage(message, (error, result) => {
                console.log(`[contract-worker] Finished work ${message}`, error, result);
                parentPort.postMessage({ error, result });
            });
        });

        console.log("[contract-worker] ready");
        parentPort.postMessage("ready");
    });
}

module.exports = boot;
