const getBricksDomainConfigFromKeySSI = (ssiString) => {
    const domain = getDomainFromKeySSI(ssiString);
    return __getDomainConfig(domain);
};

const getBricksDomainConfigByDomain = (domain) => {
    return __getDomainConfig(domain);
};

function __getDomainConfig(domain) {
    const config = require("../../../config");
    let domainConfig = config.getDomainConfig(domain, ['bricking'], ['endpointsConfig', 'bricking', 'domains']);

    return domainConfig;
}

const getDomainFromKeySSI = function (ssiString) {
    const openDSU = require("opendsu");
    const keySSISpace = openDSU.loadApi("keyssi");

    const keySSI = keySSISpace.parse(ssiString);
    const domain = keySSI.getDLDomain();
    return domain;
};

module.exports = {getBricksDomainConfigFromKeySSI, getDomainFromKeySSI, getBricksDomainConfigByDomain};