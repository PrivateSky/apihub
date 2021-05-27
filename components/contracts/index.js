const {
    getContractDomainsPath,
    getNodeWorkerBootScript,
    validatePublicCommandInput,
    validateRequireNonceCommandInput,
} = require("./utils");

function Contract(server) {
    const pathName = "path";
    const path = require(pathName);
    const fsName = "fs";
    const fs = require(fsName);
    const syndicate = require("syndicate");
    const { requestBodyJSONMiddleware, responseModifierMiddleware } = require("../../utils/middlewares");

    const contractDomainsPath = getContractDomainsPath();
    const allDomainsWorkerPools = {};

    const getDomainWorkerPool = (domain, callback) => {
        if (allDomainsWorkerPools[domain]) {
            return callback(null, allDomainsWorkerPools[domain]);
        }

        const domainConfigFilePath = path.join(server.rootFolder, contractDomainsPath, `${domain}.config`);

        fs.access(domainConfigFilePath, fs.F_OK, (err) => {
            if (err) {
                console.error(`[Contracts] Config for domain '${domain}' not found at '${domainConfigFilePath}'`);
                return callback(err);
            }

            fs.readFile(domainConfigFilePath, (err, data) => {
                if (err) {
                    console.error(
                        `[Contracts] Config for domain '${domain}' found at '${domainConfigFilePath}' but couldn't be read`
                    );
                    return callback(err);
                }

                let domainConfig;
                try {
                    domainConfig = JSON.parse(data.toString());
                } catch (error) {
                    console.error(`[Contracts] Config for domain '${domain}' couldn't be parsed. Content: ${data.toString()}`);
                    return callback(error);
                }

                console.log(`[Contracts] Starting contract handler for domain '${domain}'...`, domainConfig);

                const script = getNodeWorkerBootScript(domain, domainConfig, server.rootFolder);
                allDomainsWorkerPools[domain] = syndicate.createWorkerPool({
                    bootScript: script,
                    // maximumNumberOfWorkers: 1,
                    workerOptions: {
                        eval: true,
                    },
                });

                callback(null, allDomainsWorkerPools[domain]);
            });
        });
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

    const sendPublicCommandToWorker = (request, response) => {
        const { domain } = request.params;
        const { contract, method, params } = request.body;
        const command = { domain, contract, method, params };

        sendCommandToWorker(command, response);
    };

    const sendRequireNonceCommandToWorker = (request, response) => {
        const { domain } = request.params;
        const { contract, method, params, nonce, signerDID, signature } = request.body;
        const command = { domain, contract, method, params, nonce, signerDID, signature };

        sendCommandToWorker(command, response);
    };

    server.use(`/contracts/:domain/*`, responseModifierMiddleware);

    server.post(`/contracts/:domain/public-command`, requestBodyJSONMiddleware);
    server.post(`/contracts/:domain/public-command`, validatePublicCommandInput);
    server.post(`/contracts/:domain/public-command`, sendPublicCommandToWorker);

    server.post(`/contracts/:domain/require-nonce-command`, requestBodyJSONMiddleware);
    server.post(`/contracts/:domain/require-nonce-command`, validateRequireNonceCommandInput);
    server.post(`/contracts/:domain/require-nonce-command`, sendRequireNonceCommandToWorker);
}

module.exports = Contract;
