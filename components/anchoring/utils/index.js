const getAnchoringStrategy = (ssiString) => {
    const config = require("../../../config");
    const domain = getDomainFromKeySSI(ssiString);
    let strategy = config.getConfig('endpointsConfig', 'anchoring', 'domainStrategies', domain);

    if (!strategy) {
        strategy = config.getConfig('endpointsConfig', 'anchoring', 'domainStrategies', 'default');
    }

    return strategy;
};

const getDomainFromKeySSI = function (ssiString) {
    const openDSU = require("opendsu");
    const keySSISpace = openDSU.loadApi("keyssi");

    const keySSI = keySSISpace.parse(ssiString);
    const domain = keySSI.getDLDomain();

    return domain;
}

module.exports = {getAnchoringStrategy, getDomainFromKeySSI}