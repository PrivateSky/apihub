const { getNodeWorkerBootScript, validateCommandInput } = require("./utils");

function Contract(server) {
    const syndicate = require("syndicate");
    const { requestBodyJSONMiddleware, responseModifierMiddleware } = require("../../utils/middlewares");

    const allDomainsWorkerPools = {};

    const getDomainWorkerPool = async (domain, callback) => {
        if (allDomainsWorkerPools[domain]) {
            return callback(null, allDomainsWorkerPools[domain]);
        }

        const config = require("../../config");

        let domainConfig = config.getDomainConfig(domain) || {};
        console.log(`[Contracts] Starting contract handler for domain '${domain}'...`, domainConfig);

        // temporary create the validator here
        // TODO: move the validator did inside a config
        const w3cDID = require("opendsu").loadApi("w3cdid");
        const validatorDID = (await $$.promisify(w3cDID.createIdentity)("demo", "id")).getIdentifier();

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

    const sendLatestBlockInfoCommandToWorker = (request, response) => {
        const { domain } = request.params;
        const command = { domain, type: "lastestBlockInfo" };
        sendCommandToWorker(command, response);
    };

    const sendGetPBlockCommandToWorker = (request, response) => {
        const { domain, pBlockHashLinkSSI } = request.params;
        const command = { domain, type: "getPBlock", args: [pBlockHashLinkSSI] };
        sendCommandToWorker(command, response);
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

    const sendPBlockToValidateToWorker = (request, response) => {
        const { domain } = request.params;
        const pBlock = request.body;
        const command = { domain, type: "checkPBlockFromNetwork", args: [pBlock] };
        sendPBlockToValidateToWorker(command, response);
    };

    // todo: if command if for an unregistered domain => throw 404 -> on OPENDSU use bdns when receiving 404 => 

    server.use(`/contracts/:domain/*`, responseModifierMiddleware);
    server.use(`/contracts/:domain/*`, requestBodyJSONMiddleware);
    server.use(`/contracts/:domain/*`, validateCommandInput);

    server.get(`/contracts/:domain/latest-block-info`, sendLatestBlockInfoCommandToWorker);
    server.get(`/contracts/:domain/pblock/:pBlockHashLinkSSI`, sendGetPBlockCommandToWorker);

    server.post(`/contracts/:domain/safe-command`, sendSafeCommandToWorker);
    server.post(`/contracts/:domain/nonced-command`, sendNoncedCommandToWorker);
    server.post(`/contracts/:domain/validate`, sendPBlockToValidateToWorker);
}

module.exports = Contract;
