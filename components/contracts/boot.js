async function boot(validatorDID, domain, domainConfig, rootFolder, serverUrl) {
    console.log(
        `[contract-worker] booting contracts for domain ${domain} and domainConfig ${JSON.stringify(domainConfig)} booting...`,
        domainConfig
    );

    const worker_threads = "worker_threads";
    const { parentPort } = require(worker_threads);
    const bricksledger = require("bricksledger");

    try {
        const initiliseBrickLedger = await $$.promisify(bricksledger.initiliseBrickLedger);
        const bricksledgerInstance = await initiliseBrickLedger(validatorDID, domain, domainConfig, rootFolder, serverUrl, null);

        const handleCommand = async (command, callback) => {
            const args = command.args || [];

            if (command.type === "latestBlockInfo") {
                return bricksledgerInstance.getLatestBlockInfo(callback);
            }
            if (command.type === "validatePBlockFromNetwork") {
                return bricksledgerInstance.validatePBlockFromNetwork(...args, callback);
            }

            const commandExecutionCallback = async (error, commandExecution) => {
                if (error) {
                    return callback(error);
                }

                const promises = [commandExecution.requireConsensus(), commandExecution.getOptimisticExecutionResult()];

                try {
                    let [requireConsensus, optimisticExecutionResult] = await Promise.all(promises);
                    // in order to ensure result serializability we JSON.stringify it if isn't a Buffer
                    if (!$$.Buffer.isBuffer(optimisticExecutionResult)) {
                        optimisticExecutionResult = JSON.stringify(optimisticExecutionResult);
                    }

                    const result = {
                        requireConsensus,
                        optimisticResult: optimisticExecutionResult,
                        validatedResult: requireConsensus ? optimisticExecutionResult : null,
                    };
                    callback(null, result);
                } catch (error) {
                    callback(error);
                }
            };

            if (command.type === "safe") {
                return bricksledgerInstance.executeSafeCommand(command, commandExecutionCallback);
            }
            if (command.type === "nonced") {
                return bricksledgerInstance.executeNoncedCommand(command, commandExecutionCallback);
            }
            return callback(`Unknown command type '${type}' specified`);
        };

        parentPort.on("message", (message) => {
            if (!message) {
                return callback("[contract-worker] Received empty message!");
            }

            const command = bricksledger.createCommand(message);
            handleCommand(command, (error, result) => {
                console.log(`[contract-worker] Finished work ${message}`, error, result);
                parentPort.postMessage({ error, result });
            });
        });

        console.log("[contract-worker] ready");
        parentPort.postMessage("ready");
    } catch (error) {
        parentPort.postMessage({ error });
        throw error;
    }

    process.on("uncaughtException", (err) => {
        console.error("[contract-worker] unchaughtException inside worker", err);
        setTimeout(() => {
            process.exit(1);
        }, 100);
    });
}

module.exports = boot;
