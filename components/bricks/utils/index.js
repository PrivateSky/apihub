const getBricksDomainConfigFromKeySSI = (ssiString) => {
    const domain = getDomainFromKeySSI(ssiString);
    return __getDomainConfig(domain);
};

const getBricksDomainConfigByDomain = (domain) => {
    domain = getSafeDomain(domain);
    return __getDomainConfig(domain);
};

function __getDomainConfig(domain) {
    const config = require("../../../config");
    let domainConfig = config.getConfig('endpointsConfig', 'bricks', 'domains', domain);
    if (!domainConfig) {
        domainConfig = config.getConfig('endpointsConfig', 'bricks', 'domains', 'default');
    }
    return domainConfig;
}

const getSafeDomain = (domain) => {
    if (typeof domain === 'undefined') {
        return "default";
    }
    return domain;
};

const getDomainFromKeySSI = function (ssiString) {
    if (typeof ssiString === 'undefined') {
        return "default";
    }
    const openDSU = require("opendsu");
    const keySSISpace = openDSU.loadApi("keyssi");

    const keySSI = keySSISpace.parse(ssiString);
    const domain = keySSI.getDLDomain();
    return domain;
};

module.exports = {getBricksDomainConfigFromKeySSI, getDomainFromKeySSI, getBricksDomainConfigByDomain, getSafeDomain};