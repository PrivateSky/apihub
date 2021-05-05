const getAnchoringDomainConfig = (domain) => {
    const config = require("../../../config");
    return config.getConfig("endpointsConfig", "anchoring", "domainStrategies", domain);
};

const getDomainFromKeySSI = function (ssiString) {
    const openDSU = require("opendsu");
    const keySSISpace = openDSU.loadApi("keyssi");
    const keySSI = keySSISpace.parse(ssiString);
    return keySSI.getDLDomain();
};

const ALIAS_SYNC_ERR_CODE = "sync-error";
const ANCHOR_ALREADY_EXISTS_ERR_CODE = "anchor-already-exists";

module.exports = { getAnchoringDomainConfig, getDomainFromKeySSI, ALIAS_SYNC_ERR_CODE, ANCHOR_ALREADY_EXISTS_ERR_CODE };
