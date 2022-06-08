const { clone } = require("../../../utils");
const config = require("../../../config");

const getAnchoringDomainConfig = async (domain) => {
    const config = require("../../../config");
    let domainConfiguration = config.getDomainConfig(domain);

    if(!domainConfiguration){
        //if you don't have config we try to use admin service info to create one at runtime
        try{
            let adminService = require("./../../admin").getAdminService();
            const getDomainInfo = $$.promisify(adminService.getDomainInfo);
            let domainInfo = await getDomainInfo(domain);
            if(domainInfo && domain.active && domainInfo.cloneFromDomain){
                const clonedDomainConfiguration = config.getDomainConfig(domainInfo.cloneFromDomain);
                domainConfiguration = clonedDomainConfiguration;
                console.log(`Config for domain '${domain}' was loaded from admin service.`);
            }
        }catch(err){
            //we ignore any errors in this try-catch block because admin component may be disabled
        }
    }

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
