
const getBricksFabricStrategy = () => {
    const config = require("../../../config");
    return config.getDomainConfig('default', ['bricksFabric'], ['endpointsConfig', 'bricksFabric', 'domainStrategies']);
};

const getRootFolder = () => {
    // temporary location where we store the last hashlink
    const config = require("../../../config");
    return config.getConfig('endpointsConfig', 'bricksFabric').path;
};

module.exports.getBricksFabricStrategy = getBricksFabricStrategy;
module.exports.getRootFolder = getRootFolder;

