function escapePath(path) {
    return path ? path.replace(/\\/g, "\\\\").replace(".js", "") : "";
}

function getNodeWorkerBootScript(validatorDID, domain, domainConfig, rootFolder) {
    const contractsConfig = domainConfig.contracts;
    
    if (!contractsConfig.constitution) {
        // ensure we have the SSI for the contracts DSU speficied inside domainConfig.contracts.constitution
        if (process.env.PSK_APIHUB_DEFAULT_CONTRACTS_DOMAIN_SSI) {
            contractsConfig.constitution = process.env.PSK_APIHUB_DEFAULT_CONTRACTS_DOMAIN_SSI;
            console.log(
                `[Contracts] no constitution found for domain ${domain}. Found process.env.PSK_APIHUB_DEFAULT_CONTRACTS_DOMAIN_SSI: ${contractsConfig.constitution}`
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
                contractsConfig.constitution = defaultDomainSeedData.toString();
            } catch (error) {
                console.log(`Cannot access default domain-seed at: ${defaultDomainSeedPath}`, error);
            }
        }
    }

    const apihubBundleScriptPath = escapePath(global.bundlePaths.pskWebServer);
    const rootFolderPath = escapePath(rootFolder);
    const script = `
        require("${apihubBundleScriptPath}");
        require('apihub').bootContracts('${validatorDID}', '${domain}', ${JSON.stringify(domainConfig)}, '${rootFolderPath}');
    `;
    return script;
}

const validateCommandInput = (request, response, next) => {
    const { domain } = request.params;
    if (!domain || typeof domain !== "string") {
        return response.send(400, "Invalid domain specified");
    }

    if (!request.body) {
        return response.send(400, "Missing required body");
    }

    next();
};

module.exports = {
    getNodeWorkerBootScript,
    validateCommandInput,
};
