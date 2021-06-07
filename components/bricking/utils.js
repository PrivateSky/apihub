const getBricksDomainConfig = (domain) => {
    const config = require("../../config");
    return config.getDomainConfig(domain, ['bricking'], ['endpointsConfig', 'bricking', 'domains']);
};

module.exports = { getBricksDomainConfig };