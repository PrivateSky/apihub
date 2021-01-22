const getAnchoringDomainConfig = (domain) => {
    const config = require("../../../config");
    return config.getConfig('endpointsConfig', 'anchoring', 'domainStrategies', domain);
};

const getDomainFromKeySSI = function (ssiString) {
    const openDSU = require("opendsu");
    const keySSISpace = openDSU.loadApi("keyssi");
    const keySSI = keySSISpace.parse(ssiString);
    return keySSI.getDLDomain();
}

module.exports = {getAnchoringDomainConfig, getDomainFromKeySSI}