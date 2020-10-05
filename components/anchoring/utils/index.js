const getAnchoringStrategy = (ssiString) => {
    const config = require("../../../config");
    const openDSU = require("opendsu");
    const keySSISpace = openDSU.loadApi("keyssi");

    const keySSI = keySSISpace.parse(ssiString);
    const domain = keySSI.getDLDomain();
    let strategy = config.getConfig('endpointsConfig', 'anchoring', 'domainStrategies', domain);

    if (!strategy) {
        strategy = config.getConfig('endpointsConfig', 'anchoring', 'domainStrategies', 'default');
    }

    return strategy;
};

module.exports = {getAnchoringStrategy}