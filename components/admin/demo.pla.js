require("../../../../psknode/bundles/openDSU");
openDSURequire('overwrite-require');
const logger = $$.getLogger("demo.pla.js", "apihub/admin");

const opendsu = openDSURequire("opendsu");
const http = opendsu.loadApi("http");

const BASE_URL = "https://admin.pla.health";
const dnsDomain = "pla.health";

const MAIN_DOMAIN = "demo.epi";
const SUB_DOMAIN_BASE = "demo.epi";
const VAULT_NAME_BASE = "demo.vault";

const cloneMainDomain = "demo.epi";
const cloneVaultDomain = "demo.vault.pla";

const LEAFLET_ENV_TEMPLATE = 'export default { "appName": "eLeaflet", "vault": "server", "agent": "browser", "system": "any", "browser": "any", "mode": "autologin", "vaultDomain": "${vaultDomain}", "didDomain": "${didDomain}", "enclaveType": "WalletDBEnclave", "sw": false, "pwa": false, "allowPinLogin": false, "lockFeatures": true, "disabledFeatures": "", "epiProtocolVersion": 1}'
const DSU_ENV_TEMPLATE = 'export default { "appName": "DSU_Fabric", "vault": "server", "agent": "browser", "system": "any", "browser": "any", "mode": "dev-secure", "vaultDomain": "${vaultDomain}", "didDomain": "${didDomain}", "epiDomain": "${mainDomain}", "epiSubdomain": "${subDomain}", "enclaveType": "WalletDBEnclave", "sw": false, "pwa": false, "allowPinLogin": false, "companyName": "${companyName}", "disabledFeatures": "", "lockFeatures": true, "epiProtocolVersion": 1}';
const DEMIURGE_ENV_TEMPLATE = 'export default { "appName": "Demiurge", "vault": "server", "agent": "browser", "system": "any", "browser": "any", "mode": "dev-secure", "vaultDomain": "${vaultDomain}", "didDomain": "${didDomain}", "enclaveType":"WalletDBEnclave", "companyName": "${companyName}", "sw": false, "pwa": false}';

const templates = {
    "/demiurge-wallet/loader/environment.js": DEMIURGE_ENV_TEMPLATE,
    "/dsu-fabric-wallet/loader/environment.js": DSU_ENV_TEMPLATE,
    "/leaflet-wallet/loader/environment.js": LEAFLET_ENV_TEMPLATE
};

const companies = ["nvs", "msd", "bayer", "takeda", "jnj", "gsk", "abbvie", "pfizer"];

function getCompanyDNSDomain(name){
    return name+"."+dnsDomain;
}

function getCompanySubDomain(name) {
    return SUB_DOMAIN_BASE + "." + name;
}

function getCompanyVaultDomain(name) {
    return VAULT_NAME_BASE + "." + name;
}

function getCompanyVars(companyName) {
    return {
        companyName: companyName,
        mainDomain: MAIN_DOMAIN,
        subDomain: getCompanySubDomain(companyName),
        didDomain: getCompanyVaultDomain(companyName),
        vaultDomain: getCompanyVaultDomain(companyName),
    };
}

async function storeVariable(dns, prop, value) {
    try {
        let doPost = $$.promisify(http.doPost);
        await doPost(`${BASE_URL}/admin/${MAIN_DOMAIN}/storeVariable`, JSON.stringify({
            "dnsDomain": dns,
            "variableName": prop,
            "variableContent": value
        }));
        logger.info(`Finished storing variable ${prop}=${value} for ${dns}`);
    } catch (e) {
        console.trace(e);
        process.exit(1);
    }
}

async function createDomain(domainName, cloneFrom) {
    try {
        let doPost = $$.promisify(http.doPost);
        await doPost(`${BASE_URL}/admin/${MAIN_DOMAIN}/addDomain`, JSON.stringify({
            "domainName": domainName,
            "cloneFromDomain": cloneFrom
        }));
        logger.info(`Finished createDomain ${domainName} based on ${cloneFrom}`);
    } catch (e) {
        console.trace(e);
        process.exit(1);
    }
}

async function registerTemplate(path, content) {
    try {
        let doPost = $$.promisify(http.doPost);
        await doPost(`${BASE_URL}/admin/${MAIN_DOMAIN}/registerTemplate`, JSON.stringify({
            path,
            content
        }));
        logger.info(`Finished registering template for path ${path}`);
    } catch (e) {
        console.trace(e);
        process.exit(1);
    }
}

(async () => {

    for(let path in templates){
        let content = templates[path];
        await registerTemplate(path, content);
    }

    let companyVars = {
        companyName: "PLA",
        mainDomain: MAIN_DOMAIN,
        subDomain: MAIN_DOMAIN,
        didDomain: cloneVaultDomain,
        vaultDomain: cloneVaultDomain,
    };

    for(let prop in companyVars){
        await storeVariable("admin.pla.health", prop, companyVars[prop]);
    }

    for(let i=0; i<companies.length; i++){
        let companyName = companies[i];

        await createDomain(getCompanySubDomain(companyName), cloneMainDomain);
        await createDomain(getCompanyVaultDomain(companyName), cloneVaultDomain);

        let companyDNS = getCompanyDNSDomain(companyName);
        let companyVars = getCompanyVars(companyName);
        for(let prop in companyVars){
            await storeVariable(companyDNS, prop, companyVars[prop]);
        }
    }
})();
