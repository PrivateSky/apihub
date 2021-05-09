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

        const handleMessage = (message, callback) => {
            if (!message) {
                return callback("[contract-worker] Received empty message!");
            }

            const { contract: contractName, method, methodParams = [], isLocalCall } = message;
            const contractHandler = contractHandlers[contractName];
            if (!contractHandler) {
                return callback(`[contract-worker] Unkwnown contract '${contractName}'`);
            }

            if (!contractHandler[method]) {
                return callback(`[worker] Unkwnown contract method '${method}' for contract '${contractName}'`);
            }

            try {
                // check if the contract method call is allowed
                const isContractMethodCallAllowed =
                    typeof contractHandler.allowExecution === "function" &&
                    contractHandler.allowExecution(isLocalCall, method, methodParams);
                if (!isContractMethodCallAllowed) {
                    return callback(`[contract-worker] method '${method}' for contract '${contractName}' is not allowed`);
                }

                // check if the contract method can be executed immediately, otherwise run consensus
                const canExecuteContractMethodImmediately =
                    typeof contractHandler.canExecuteImmediately === "function" &&
                    contractHandler.canExecuteImmediately(isLocalCall, method, methodParams);
                if (canExecuteContractMethodImmediately) {
                    return contractHandler[method].call(contractHandler, ...methodParams, callback);
                }

                // run consensus
                const consensusHandler = contractHandlers.consensus;
                if (!consensusHandler) {
                    return callback(`[contract-worker] missing consensus contract!`);
                }

                const command = {
                    contract: contractName,
                    method,
                    params: methodParams,
                };
                consensusHandler.proposeCommand(command, (error, result) => {
                    if (error) {
                        return callback(error);
                    }

                    if (result) {
                        return contractHandler[method].call(contractHandler, ...methodParams, callback);
                    }

                    return callback("[contract-worker] consensus wasn't reached");
                });
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
