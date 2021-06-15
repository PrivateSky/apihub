const { clone } = require("../../../utils");

const getBricksFabricStrategy = () => {
    const config = require("../../../config");
    let domainConfig = config.getDomainConfig("default", "bricksFabric");

    if (!domainConfig) {
        // try to get the bricks strategy based on the bricksFabric component config
        const bricksFabricConfig = config.getConfig("componentsConfig", "bricksFabric");
        if (bricksFabricConfig) {
            const { bricksFabricStrategy, bricksFabricStrategyOption } = bricksFabricConfig;
            domainConfig = {
                name: bricksFabricStrategy,
                option: bricksFabricStrategyOption,
            };
        }
    }
    domainConfig = clone(domainConfig || {});
    return domainConfig;
};

const getRootFolder = () => {
    // temporary location where we store the last hashlink
    const config = require("../../../config");
    return config.getConfig("componentsConfig", "bricksFabric").path;
};

module.exports.getBricksFabricStrategy = getBricksFabricStrategy;
module.exports.getRootFolder = getRootFolder;
