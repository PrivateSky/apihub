function removeConfigComponent(config) {
    if (config.componentsConfig && config.componentsConfig.config) {
        delete config.componentsConfig.config;
    }
}

function traverseObjectProvidedPrimitiveValues(item, onItemTraversal) {
    if (Array.isArray(item)) {
        item.forEach((element) => traversePrimitiveItemValues(element, onItemTraversal));
    } else if (typeof item === "object" && item != null) {
        Object.values(item)
            .filter((key) => item[key])
            .forEach((key) => {
                const value = item[key];
                if (isArray(value) || typeof item === "object") {
                    traverseObjectProvidedPrimitiveValues(value, onItemTraversal);
                } else {
                    onItemTraversal(item, key);
                }
            });
    }
}

function replaceInternalVolumePathsWithExternalVolume(config) {
    traverseObjectProvidedPrimitiveValues(config, (item, key) => {
        let value = item[key];
        console.log("Traversed", key, value);
        if (key === "path" && typeof value === "string" && value.indexOf("internal-volume") !== -1) {
            item[key] = value.replace("internal-volume", "external-volume");
        }
    });
}

function removeBrickingPathConfig(config) {
    if (config.componentsConfig && config.componentsConfig.bricking && config.componentsConfig.bricking.domains) {
        const brickingDomains = config.componentsConfig.bricking.domains;
        Object.keys(brickingDomains).forEach((domain) => {
            delete brickingDomains[domain].path;
        });
    }
}

function removeAnchoringPathConfig(config) {
    if (config.componentsConfig && config.componentsConfig.anchoring && config.componentsConfig.anchoring.domainStrategies) {
        const anchoringDomains = config.componentsConfig.anchoring.domainStrategies;
        Object.keys(anchoringDomains).forEach((domain) => {
            const domainConfig = anchoringDomains[domain];
            if (domainConfig.type === "FS" && domainConfig.option) {
                delete domainConfig.option.path;
            }
        });
    }
}

function extractDomainConfigsAndRemoveThemFromConfig(config) {
    const domainConfigs = {};

    const { componentsConfig } = config;
    if (componentsConfig) {
        const { bricking, anchoring, bricksFabric } = componentsConfig;

        if (bricking) {
            // remove the domains property from bricking since the only used config is "path" which is constructed by convention
            delete bricking.domains;
        }

        if (anchoring && anchoring.domainStrategies) {
            const { domainStrategies } = anchoring;
            Object.keys(domainStrategies).forEach((domain) => {
                if (!domainConfigs[domain]) {
                    domainConfigs[domain] = {};
                }
                const domainConfig = domainConfigs[domain];
                domainConfig.anchoring = {
                    ...domainStrategies[domain],
                };

                if (domainConfig.anchoring.option) {
                    // remove the "path" config which is constructed by convention
                    delete domainConfig.anchoring.option.path;
                }
            });

            delete anchoring.domainStrategies;
        }

        if (bricksFabric && bricksFabric.domainStrategies) {
            const { domainStrategies } = bricksFabric;
            Object.keys(domainStrategies).forEach((domain) => {
                if (!domainConfigs[domain]) {
                    domainConfigs[domain] = {};
                }
                const domainConfig = domainConfigs[domain];
                domainConfig.bricksFabric = {
                    ...domainStrategies[domain],
                };
            });

            delete bricksFabric.domainStrategies;
        }
    }

    return domainConfigs;
}

function migrate(oldConfig, configFolderPath) {
    // create a clone in order to not influence config from outside of the migrator
    oldConfig = JSON.parse(JSON.stringify(oldConfig));

    const { storage, sslFolder, port, host, preventRateLimit, tokenBucket } = oldConfig;
    const { enableInstallationDetails, enableRequestLogger, enableLocalhostAuthorization } = oldConfig;
    const config = {
        storage,
        sslFolder,
        port,
        host,
        preventRateLimit,
        activeComponents: oldConfig.activeEndpoints,
        componentsConfig: oldConfig.endpointsConfig,
        tokenBucket,
        enableInstallationDetails,
        enableRequestLogger,
        enableJWTAuthorisation: oldConfig.enableAuthorisation,
        enableLocalhostAuthorization,
        skipJWTAuthorisation: oldConfig.skipAuthorisation,
    };

    removeConfigComponent(config);
    replaceInternalVolumePathsWithExternalVolume(config);
    removeBrickingPathConfig(config);
    removeAnchoringPathConfig(config);

    const domainConfigs = extractDomainConfigsAndRemoveThemFromConfig(config);

    const path = require("path");
    const fs = require("fs");
    const apihubJsonConfigPath = path.join(configFolderPath, "apihub.json");
    console.log(`Generating apihub.json config file at ${apihubJsonConfigPath}...`);

    if (!fs.existsSync(configFolderPath)) {
        fs.mkdirSync(configFolderPath, { recursive: true });
    }
    fs.writeFileSync(apihubJsonConfigPath, JSON.stringify(config, null, 2));

    const domainConfigsFolderPath = path.join(configFolderPath, "domains");
    if (!fs.existsSync(domainConfigsFolderPath)) {
        fs.mkdirSync(domainConfigsFolderPath, { recursive: true });
    }

    Object.keys(domainConfigs).forEach((domain) => {
        const domainConfig = domainConfigs[domain];
        const domainConfigPath = path.join(domainConfigsFolderPath, `${domain}.json`);
        console.log(`Generating config file for domain '${domain}' at ${domainConfigPath}...`);
        fs.writeFileSync(domainConfigPath, JSON.stringify(domainConfig, null, 2));
    });

    try {
        const serverJsonConfigPath = path.join(configFolderPath, "server.json");
        fs.unlinkSync(serverJsonConfigPath);
    } catch (error) {
        console.log("Could not delete old server.json file", error);
    }
}

module.exports = {
    migrate,
};
