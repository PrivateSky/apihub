function BDNS(server) {
    const DOMAIN_TEMPLATE = {
        "replicas": [],
        "brickStorages": [
            "$ORIGIN"
        ],
        "anchoringServices": [
            "$ORIGIN"
        ],
        "notifications": [
            "$ORIGIN"
        ]
    };
    const URL_PREFIX = "/bdns";
    const {headersMiddleware} = require('../../utils/middlewares');

    let bdnsCache;
    const config = require("../../config");
    const bdnsConfig = config.getConfig("componentsConfig", "bdns");

    async function getBDNSHostsFromURL(url) {
        const http = require("opendsu").loadAPI("http");
        const bdnsHosts = await http.fetch(url).then(res => res.json());
        return bdnsHosts
    }

    let init_process_runned = false;

    async function initialize() {
        if (init_process_runned) {
            return true;
        }
        init_process_runned = true;
        const fs = require("fs");
        const path = require("path");

        const bdnsHostsPath = path.join(process.env.PSK_CONFIG_LOCATION, "bdns.hosts");

        bdnsCache = fs.readFileSync(bdnsHostsPath).toString();

        if (bdnsConfig && bdnsConfig.url) {
            try {
                const bdnsExtensions = await getBDNSHostsFromURL(bdnsConfig.url);
                let newRegistry = JSON.parse(bdnsCache);
                Object.assign(newRegistry, bdnsExtensions);
                bdnsCache = JSON.stringify(newRegistry);
            } catch (e) {
                console.log(`Failed to get bdns hosts from url`, e);
            }
        }

        try {
            console.log("Testing to see if admin component is active and can be used to expand BDNS configuration.");
            let adminService = require("./../admin").getAdminService();
            let getDomains = $$.promisify(adminService.getDomains);
            let domains = await getDomains();
            if (domains) {
                let bdnsExtensions = {};
                for (let i = 0; i < domains.length; i++) {
                    let domain = domains[i];
                    if (domain.active) {
                        bdnsExtensions[domain.name] = DOMAIN_TEMPLATE;
                    }
                }
                let newRegistry = JSON.parse(bdnsCache);
                Object.assign(newRegistry, bdnsExtensions);
                bdnsCache = JSON.stringify(newRegistry);
            }
            console.log("BDNS configuration was updated accordingly to information retrieved from admin service");
        } catch (err) {
            console.info("Admin service not available, skipping the process of loading dynamic configured domains. This is not a problem, it's a configuration.");
        }
    }

    async function bdnsHandler(request, response, next) {
        try {
            await initialize();
        } catch (e) {
            response.statusCode = 500;
            return response.end('Failed to initialize BDNS');
        }

        if (typeof bdnsCache !== "undefined") {
            response.setHeader('content-type', 'application/json');
            response.statusCode = 200;
            response.end(bdnsCache);
        } else {
            console.log("Bdns config not available at this moment. A 404 response will be sent.");
            response.statusCode = 404;
            return response.end('BDNS hosts not found');
        }
    }

    server.use(`${URL_PREFIX}/*`, headersMiddleware);
    server.get(URL_PREFIX, bdnsHandler);
}

module.exports = BDNS;
