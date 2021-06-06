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

        // TODO: the domain config should be loaded in the following way when the domain configuration will be united/stable
        // let domainConfig = config.getDomainConfig(domain)

        let domainConfig = {
            contracts: config.getDomainConfig(domain, ["contracts"], ["endpointsConfig", "contracts"]) || {},
            anchoring: config.getDomainConfig(domain, ["anchoring"], ["endpointsConfig", "anchoring", "domainStrategies"]) || {},
            bricking: config.getDomainConfig(domain, ["contracts"], ["endpointsConfig", "bricking", "domains"]) || {},
            bricksFabric:
                config.getDomainConfig(domain, ["contracts"], ["endpointsConfig", "bricksFabric", "domainStrategies"]) || {},
        };

        console.log(`[Contracts] Starting contract handler for domain '${domain}'...`, domainConfig);

        const validatorDID = null;
        const { rootFolder } = server;
        const script = getNodeWorkerBootScript(validatorDID, domain, domainConfig, rootFolder);
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
