const {
    ensureContractConstitutionIsPresent,
    getNodeWorkerBootScript,
    validateCommandInput,
    validatePostCommandInput,
} = require("./utils");

function Contract(server) {
    const config = require("../../config");

    const serverUrl = `${server.protocol}://${config.getConfig("host")}:${config.getConfig("port")}`;

    const syndicate = require("syndicate");
    const { requestBodyJSONMiddleware, responseModifierMiddleware } = require("../../utils/middlewares");

    const allDomainsWorkerPools = {};

    const getDomainWorkerPool = async (domain, callback) => {
        if (allDomainsWorkerPools[domain]) {
            return callback(null, allDomainsWorkerPools[domain]);
        }

        const domainConfig = { ...(config.getDomainConfig(domain) || {}) };
        ensureContractConstitutionIsPresent(domain, domainConfig);
        if (!domainConfig.contracts.constitution) {
            return callback(`[Contracts] Cannot boot worker for domain '${domain}' due to missing constitution`);
        }

        console.log(`[Contracts] Starting contract handler for domain '${domain}'...`, domainConfig);

        // temporary create the validator here in case the config doesn't have one specified
        const w3cDID = require("opendsu").loadApi("w3cdid");
        const validatorDID =
            config.getConfig("validatorDID") || (await $$.promisify(w3cDID.createIdentity)("demo", "id")).getIdentifier();

        const { rootFolder } = server;
        const externalStorageFolder = require("path").join(rootFolder, config.getConfig("externalStorage"));
        const script = getNodeWorkerBootScript(validatorDID, domain, domainConfig, rootFolder, externalStorageFolder, serverUrl);
        allDomainsWorkerPools[domain] = syndicate.createWorkerPool({
            bootScript: script,
            maximumNumberOfWorkers: 1,
            workerOptions: {
                eval: true,
            },
        });

        callback(null, allDomainsWorkerPools[domain]);
    };

    const sendCommandToWorker = (command, response, mapSuccessResponse) => {
        getDomainWorkerPool(command.domain, (err, workerPool) => {
            if (err) {
                return response.send(400, err);
            }

            // console.log(`[${config.getConfig("validatorDID")}][Contracts] api worker sending`, command);
            workerPool.addTask(command, (err, message) => {
                if (err) {
                    return response.send(500, err);
                }

                let { error, result } = message;

                if (error) {
                    console.log("@ command error", error, command);
                    return response.send(500, error);
                }

                if (result && result.optimisticResult) {
                    if (result.optimisticResult instanceof Uint8Array) {
                        // convert Buffers to String to that the result could be send correctly
                        result.optimisticResult = Buffer.from(result.optimisticResult).toString("utf-8");
                    } else {
                        try {
                            result.optimisticResult = JSON.parse(result.optimisticResult);
                        } catch (error) {
                            // the response isn't a JSON so we keep it as it is
                        }
                    }
                }

                if (typeof mapSuccessResponse === "function") {
                    result = mapSuccessResponse(result);
                }

                return response.send(200, result);
            });
        });
    };

    const sendGetBdnsEntryToWorker = (request, response) => {
        const { domain, entry } = request.params;
        if (!entry || typeof entry !== "string") {
            return response.send(400, "Invalid entry specified");
        }
        const command = {
            domain,
            contractName: "bdns",
            methodName: "getDomainEntry",
            params: [entry],
            type: "safe",
        };
        const mapSuccessResponse = (result) => (result ? result.optimisticResult : null);
        sendCommandToWorker(command, response, mapSuccessResponse);
    };

    const sendLatestBlockInfoCommandToWorker = (request, response) => {
        const { domain } = request.params;
        const command = { domain, type: "latestBlockInfo" };
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
        const message = request.body;
        const command = { domain, type: "validatePBlockFromNetwork", params: [message] };
        sendCommandToWorker(command, response);
    };

    const sendValidatorNonInclusionToWorker = (request, response) => {
        const { domain } = request.params;
        const message = request.body;
        const command = { domain, type: "setValidatorNonInclusion", params: [message] };
        sendCommandToWorker(command, response);
    };

    server.use(`/contracts/:domain/*`, responseModifierMiddleware);
    server.use(`/contracts/:domain/*`, requestBodyJSONMiddleware);
    server.use(`/contracts/:domain/*`, validateCommandInput);
    server.post(`/contracts/:domain/*`, validatePostCommandInput);

    server.get(`/contracts/:domain/bdns-entries/:entry`, sendGetBdnsEntryToWorker);
    server.get(`/contracts/:domain/latest-block-info`, sendLatestBlockInfoCommandToWorker);
    server.post(`/contracts/:domain/safe-command`, sendSafeCommandToWorker);
    server.post(`/contracts/:domain/nonced-command`, sendNoncedCommandToWorker);
    server.post(`/contracts/:domain/pblock-added`, sendPBlockToValidateToWorker);
    server.post(`/contracts/:domain/validator-non-inclusion`, sendValidatorNonInclusionToWorker);
}

module.exports = Contract;
