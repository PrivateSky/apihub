const getAnchoringDomainConfig = (ssiString) => {
    const config = require("../../../config");
    const domain = getDomainFromKeySSI(ssiString);
    let domainConfig = config.getConfig('endpointsConfig', 'anchoring', 'domainStrategies', domain);

    if (!domainConfig) {
        domainConfig = config.getConfig('endpointsConfig', 'anchoring', 'domainStrategies', 'default');
    }

    return domainConfig;
};

const getDomainFromKeySSI = function (ssiString) {
    const openDSU = require("opendsu");
    const keySSISpace = openDSU.loadApi("keyssi");

    const keySSI = keySSISpace.parse(ssiString);
    const domain = keySSI.getDLDomain();
    return domain;
}

module.exports = {getAnchoringDomainConfig, getDomainFromKeySSI}