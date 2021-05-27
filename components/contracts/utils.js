const getContractDomainsPath = () => {
    const config = require("../../config");
    return config.getConfig("endpointsConfig", "contracts", "domainsPath");
};

function getNodeWorkerBootScript(domain, domainConfig, rootFolder) {
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
    const rootFolderPath = rootFolder.replace(/\\/g, "\\\\");
    const script = `
        require("${apihubBundleScriptPath}");
        require('apihub').bootContracts('${domain}', ${JSON.stringify(domainConfig)}, '${rootFolderPath}')`;
    return script;
}

const validatePublicCommandInput = (request, response, next) => {
    const { domain } = request.params;
    if (!domain || typeof domain !== "string") {
        return response.send(400, "Invalid domain specified");
    }

    if (!request.body) {
        return response.send(400, "Missing required body");
    }

    const { contract, method, params } = request.body;

    if (!contract || typeof contract !== "string") {
        return response.send(400, `Invalid contract specified`);
    }
    if (!method || typeof method !== "string") {
        return response.send(400, `Invalid method specified`);
    }

    if (params && !Array.isArray(params)) {
        return response.send(400, `Invalid params specified`);
    }

    next();
};

const validateRequireNonceCommandInput = (request, response, next) => {
    validatePublicCommandInput(request, response, async () => {
        const { contract, method, params, nonce, signerDID: signerDIDIdentifier, signature } = request.body;

        if (!nonce) {
            return response.send(400, `Missing required nonce`);
        }
        if (!signerDIDIdentifier || typeof signerDIDIdentifier !== "string") {
            return response.send(400, `Invalid signerDID specified`);
        }

        if (!signature || typeof signature !== "string") {
            return response.send(400, `Invalid signature specified`);
        }

        const { domain } = request.params;
        const paramsString = params ? JSON.stringify(params) : null;
        const fieldsToHash = [domain, contract, method, paramsString, nonce].filter((x) => x != null);
        const hash = fieldsToHash.join(".");

        let signerDID;
        try {
            const w3cDID = require("opendsu").loadApi("w3cdid");
            signerDID = await $$.promisify(w3cDID.resolveDID)(signerDIDIdentifier);
        } catch (error) {
            return response.send(400, error);
        }
        try {
            const isValidSignature = await $$.promisify(signerDID.verify)(hash, signature);
            if (!isValidSignature) {
                return response.send(400, "Invalid signature specified");
            }
        } catch (error) {
            return response.send(400, error);
        }

        next();
    });
};

module.exports = {
    getContractDomainsPath,
    getNodeWorkerBootScript,
    validatePublicCommandInput,
    validateRequireNonceCommandInput,
};
