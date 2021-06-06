async function boot(domain, domainConfig) {
    console.log(
        `[contract-worker] booting contracts for domain ${domain} and domainConfig ${JSON.stringify(domainConfig)} booting...`,
        domainConfig
    );

    const worker_threads = "worker_threads";
    const { parentPort } = require(worker_threads);
    const bricksledger = require("bricksledger");

    try {
        const initiliseBrickLedger = await $$.promisify(bricksledger.initiliseBrickLedger);
        const bricksledgerInstance = await initiliseBrickLedger(domain, domainConfig, null);

        const handleCommand = async (command, callback) => {
            if (command.type === "safe") {
                return bricksledgerInstance.executeSafeCommand(command, callback);
            }
            if (command.type === "nonced") {
                return bricksledgerInstance.executeNoncedCommand(command, callback);
            }
            return callback(`Unknown command type '${type}' specified`)
        };

        parentPort.on("message", (message) => {
            if (!message) {
                return callback("[contract-worker] Received empty message!");
            }

            handleCommand(message, (error, result) => {
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

module.exports = {
    boot,
};
