async function boot(validatorDID, serverUrl, domain, domainConfig, rootFolder, storageFolder) {
    const logger = $$.getLogger("boot", "apihub/contracts");
    const logPrefix = `[contract-worker][${validatorDID}][domain]`;
    logger.info(
        `${logPrefix} Booting contracts for domain ${domain} and domainConfig ${JSON.stringify(domainConfig)} booting...`,
        domainConfig
    );

    const worker_threads = "worker_threads";
    const { parentPort } = require(worker_threads);
    const bricksledger = require("bricksledger");

    try {
        const initiliseBrickLedger = await $$.promisify(bricksledger.initiliseBrickLedger);
        const bricksledgerInstance = await initiliseBrickLedger(
            validatorDID,
            serverUrl,
            domain,
            domainConfig,
            rootFolder,
            storageFolder
        );

        const handleCommand = async (command, callback) => {
            const params = command.params || [];

            if (command.type === "latestBlockInfo") {
                return bricksledgerInstance.getLatestBlockInfo(callback);
            }
            if (command.type === "validatePBlockFromNetwork") {
                return bricksledgerInstance.validatePBlockFromNetwork(...params, callback);
            }
            if (command.type === "setValidatorNonInclusion") {
                return bricksledgerInstance.setValidatorNonInclusion(...params, callback);
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
                return callback(`${logPrefix} Received empty message!`);
            }

            const command = bricksledger.createCommand(message);
            handleCommand(command, (error, result) => {
                parentPort.postMessage({ error, result });
            });
        });

        logger.info(`${logPrefix} ready`);
        parentPort.postMessage("ready");
    } catch (error) {
        parentPort.postMessage({ error });
        throw error;
    }

    process.on("uncaughtException", (err) => {
        console.error(`${logPrefix} unchaughtException inside worker`, err);
        setTimeout(() => {
            process.exit(1);
        }, 100);
    });
}

module.exports = boot;
