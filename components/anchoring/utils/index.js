const { clone } = require("../../../utils");

const getAnchoringDomainConfig = async (domain) => {
    const config = require("../../../config");
    let domainConfiguration = await config.getSafeDomainConfig(domain);

    if (!domainConfiguration) {
        return;
    }

    let domainConfig = domainConfiguration.anchoring;

    if (!domainConfig) {
        // try to get the anchoring strategy based on the anchoring component config
        const anchoringConfig = config.getConfig("componentsConfig", "anchoring");

        if (anchoringConfig) {
            const { anchoringStrategy } = anchoringConfig;
            domainConfig = {
                type: anchoringStrategy,
            };
        } else {
            return;
        }
    }

    domainConfig = clone(domainConfig || {});
    domainConfig.option = domainConfig.option || {};
    domainConfig.option.path = require("path").join(config.getConfig("externalStorage"), `domains/${domain}/anchors`);

    return domainConfig;
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
