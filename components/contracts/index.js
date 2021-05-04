const getContractDomainsPath = () => {
    const config = require("../../config");
    return config.getConfig("endpointsConfig", "contracts", "domainsPath");
};

function getNodeWorkerBootScript(domain, domainConfig) {
    if (!domainConfig.constitution) {
        if (process.env.PSK_APIHUB_DEFAULT_CONTRACTS_DOMAIN_SSI) {
            domainConfig.constitution = process.env.PSK_APIHUB_DEFAULT_CONTRACTS_DOMAIN_SSI;
            console.log(
                `[Contracts] no constitution found for domain ${domain}. Found process.env.PSK_APIHUB_DEFAULT_CONTRACTS_DOMAIN_SSI: ${domainConfig.constitution}`
            );
        } else {
            const pathName = "path";
            const path = require(pathName);
            const fsName = "fs";
            const fs = require(fsName);

            const pskFolder = process.env.PSK_ROOT_INSTALATION_FOLDER || path.resolve("." + __dirname + "/../../../..");
            const defaultDomainSeedPath = path.join(pskFolder, "modules/apihub-contracts/domain-seed");

            console.log(
                `[Contracts] no constitution found for domain ${domain}. Trying to load constitution at ${defaultDomainSeedPath}...`
            );

            try {
                fs.accessSync(defaultDomainSeedPath, fs.F_OK);
                const defaultDomainSeedData = fs.readFileSync(defaultDomainSeedPath);
                domainConfig.constitution = defaultDomainSeedData.toString();
            } catch (error) {
                console.log(`Cannot access default domain-seed at: ${defaultDomainSeedPath}`, error);
            }
        }
    }

    const apihubBundleScriptPath = global.bundlePaths.pskWebServer.replace(/\\/g, "\\\\").replace(".js", "");
    const script = `
        require("${apihubBundleScriptPath}");
        require('apihub').bootContracts('${domain}', ${JSON.stringify(domainConfig)})`;
    return script;
}

function Contract(server) {
    const pathName = "path";
    const path = require(pathName);
    const fsName = "fs";
    const fs = require(fsName);
    const syndicate = require("syndicate");
    const { responseModifierMiddleware } = require("../../utils/middlewares");

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
                    console.error(`[Contracts] Config for domain '${domain}' found at '${domainConfigFilePath}' but couldn't be read`);
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

                const script = getNodeWorkerBootScript(domain, domainConfig);
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
    }

    const runContractMethod = (request, response) => {
        const { domain, contract, method, params: encodedMethodParams } = request.params;


        getDomainWorkerPool(domain, (err, workerPool) => {
            if (err) {
                return response.send(400, err);
            }

            let methodParams = [];
            if (encodedMethodParams) {
                const opendsu = require("opendsu");
                const crypto = opendsu.loadAPI("crypto");

                try {
                    const decodedMethodParams = crypto.decodeBase58(encodedMethodParams);
                    methodParams = JSON.parse(decodedMethodParams);
                } catch (error) {
                    console.error(`[Contracts] Failed to decode method params: ${encodedMethodParams}`);
                    return response.send(400, error);
                }
            }

            const task = {
                contract,
                method,
                methodParams,
                isLocalCall: true, // todo: check if the req is comming from localhost or proxy from localhost
            };
            workerPool.addTask(task, (err, message) => {
                if (err) {
                    return response.send(500, err);
                }

                let { error, result } = message;

                if (error) {
                    return response.send(500, error);
                }

                return response.send(200, result);
            });
        })
    };

    server.use(`/contracts/:domain/*`, responseModifierMiddleware);

    server.get(`/contracts/:domain/:contract/:method`, runContractMethod);
    server.get(`/contracts/:domain/:contract/:method/:params`, runContractMethod);
}

module.exports = Contract;
