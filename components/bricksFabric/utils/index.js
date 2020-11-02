
const getBricksFabricStrategy = () => {
    const config = require("../../../config");
    return config.getConfig('endpointsConfig', 'bricksFabric', 'domainStrategies', 'default');
};

const getRootFolder = () => {
    // temporary location where we store the last hashlink
    const config = require("../../../config");
    return config.getConfig('endpointsConfig', 'bricksFabric').path;
};

module.exports.getBricksFabricStrategy = getBricksFabricStrategy;
module.exports.getRootFolder = getRootFolder;

