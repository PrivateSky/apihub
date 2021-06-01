const { getNodeWorkerBootScript, validateCommandInput } = require("./utils");

function Contract(server) {
    const syndicate = require("syndicate");
    const { requestBodyJSONMiddleware, responseModifierMiddleware } = require("../../utils/middlewares");

    const allDomainsWorkerPools = {};

    const getDomainWorkerPool = (domain, callback) => {
        if (allDomainsWorkerPools[domain]) {
            return callback(null, allDomainsWorkerPools[domain]);
        }

        const config = require("../../config");

        let domainConfig = config.getDomainConfig(domain, ["contracts"], ["endpointsConfig", "contracts", "domainsPath"]) || {};
        domainConfig.rootFolder = server.rootFolder;

        console.log(`[Contracts] Starting contract handler for domain '${domain}'...`, domainConfig);

        const script = getNodeWorkerBootScript(domain, domainConfig);
        allDomainsWorkerPools[domain] = syndicate.createWorkerPool({
            bootScript: script,
            maximumNumberOfWorkers: 1,
            workerOptions: {
                eval: true,
            },
        });

        callback(null, allDomainsWorkerPools[domain]);
    };

    const sendCommandToWorker = (command, response) => {
        getDomainWorkerPool(command.domain, (err, workerPool) => {
            if (err) {
                return response.send(400, err);
            }

            // console.log("[Contracts] Sending command to worker", command);
            workerPool.addTask(command, (err, message) => {
                if (err) {
                    return response.send(500, err);
                }

                let { error, result } = message;

                if (error) {
                    return response.send(500, error);
                }

                return response.send(200, result);
            });
        });
    };

    const sendSafeCommandToWorker = (request, response) => {
        const { domain } = request.params;
        const command = { ...request.body, domain, type: "safe" };
        sendCommandToWorker(command, response);
    };

    const sendNoncedCommandToWorker = (request, response) => {
        const { domain } = request.params;
        const command = { ...request.body, domain, type: "nonced" };
        sendCommandToWorker(command, response);
    };

    server.use(`/contracts/:domain/*`, responseModifierMiddleware);

    server.post(`/contracts/:domain/safe-command`, requestBodyJSONMiddleware);
    server.post(`/contracts/:domain/safe-command`, validateCommandInput);
    server.post(`/contracts/:domain/safe-command`, sendSafeCommandToWorker);

    server.post(`/contracts/:domain/nonced-command`, requestBodyJSONMiddleware);
    server.post(`/contracts/:domain/nonced-command`, validateCommandInput);
    server.post(`/contracts/:domain/nonced-command`, sendNoncedCommandToWorker);
}

module.exports = Contract;
