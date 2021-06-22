require("../../../../psknode/bundles/testsRuntime");
const testIntegration = require("../../../../psknode/tests/util/tir");

const fs = require("fs");
const path = require("path");

const dc = require("double-check");
const assert = dc.assert;

const ConfigMigrator = require("../../config/config-migrator");

const initialConfig = {
    port: 8080,
    storage: "../apihub-root",
    preventRateLimit: true,
    enableRequestLogger: true,
    activeEndpoints: [
        "virtualMQ",
        "messaging",
        "notifications",
        "filesManager",
        "bdns",
        "bricksFabric",
        "bricking",
        "anchoring",
        "dsu-wizard",
        "gtin-dsu-wizard",
        "epi-mapping-engine",
        "debugLogger",
        "staticServer",
    ],
    endpointsConfig: {
        "epi-mapping-engine": {
            module: "./../../epi-utils",
            function: "getEPIMappingEngineForAPIHUB",
            options: {
                walletSSI: "#validWalletSSIHere",
            },
        },
        "gtin-dsu-wizard": {
            module: "./../../gtin-dsu-wizard",
        },
        bricking: {
            domains: {
                epi: {
                    path: "/external-volume/domains/epi/brick-storage",
                },
                epidev: {
                    path: "/external-volume/domains/epidev/brick-storage",
                },
                "mah1.epidev": {
                    path: "/external-volume/domains/mah1.epidev/brick-storage",
                },
                "mah2.epidev": {
                    path: "/external-volume/domains/mah2.epidev/brick-storage",
                },
                default: {
                    path: "/internal-volume/domains/default/brick-storage",
                },
                predefined: {
                    path: "/internal-volume/domains/predefined/brick-storage",
                },
                vault: {
                    path: "/external-volume/domains/vault/brick-storage",
                },
                "vault.nvs": {
                    path: "/external-volume/domains/vault.nvs/brick-storage",
                },
            },
        },
        anchoring: {
            domainStrategies: {
                epi: {
                    type: "FS",
                    option: {
                        path: "/external-volume/domains/epi/anchors",
                    },
                    commands: {
                        addAnchor: "anchor",
                    },
                },
                epidev: {
                    type: "FS",
                    option: {
                        path: "/external-volume/domains/epidev/anchors",
                    },
                    commands: {
                        addAnchor: "anchor",
                    },
                },
                "mah1.epidev": {
                    type: "FS",
                    option: {
                        path: "/external-volume/domains/mah1.epidev/anchors",
                    },
                    commands: {
                        addAnchor: "anchor",
                    },
                },
                "mah2.epidev": {
                    type: "FS",
                    option: {
                        path: "/external-volume/domains/mah2.epidev/anchors",
                    },
                    commands: {
                        addAnchor: "anchor",
                    },
                },
                default: {
                    type: "FS",
                    option: {
                        path: "/internal-volume/domains/default/anchors",
                    },
                    commands: {
                        addAnchor: "anchor",
                    },
                },
                epi2: {
                    type: "ETH",
                    option: {
                        endpoint: "http://a650cecc321a54722a8c32c9a195466a-709616493.eu-west-2.elb.amazonaws.com:3000",
                    },
                    commands: {
                        addAnchor: "anchor",
                    },
                },
                predefined: {
                    type: "FS",
                    option: {
                        path: "/internal-volume/domains/predefined/anchors",
                    },
                },
                vault: {
                    type: "FS",
                    option: {
                        path: "/external-volume/domains/vault/anchors",
                    },
                },
                "vault.nvs": {
                    type: "FS",
                    option: {
                        path: "/external-volume/domains/vault.nvs/anchors",
                    },
                },
            },
        },
    },
    enableAuthorisation: false,
    enableLocalhostAuthorization: false,
    skipAuthorisation: [
        "/assets",
        "/leaflet-wallet",
        "/dsu-fabric-wallet",
        "/directory-summary",
        "/resources",
        "/bdns",
        "/anchor/epi",
        "/anchor/default",
        "/anchor/vault",
        "/bricking",
        "/bricksFabric",
        "/create-channel",
        "/forward-zeromq",
        "/send-message",
        "/receive-message",
        "/files",
        "/notifications",
        "/mq",
    ],
};

const expectedConfig = {
    storage: "../apihub-root",
    port: 8080,
    preventRateLimit: true,
    activeComponents: [
        "virtualMQ",
        "messaging",
        "notifications",
        "filesManager",
        "bdns",
        "bricksFabric",
        "bricking",
        "anchoring",
        "dsu-wizard",
        "gtin-dsu-wizard",
        "epi-mapping-engine",
        "debugLogger",
        "staticServer",
    ],
    componentsConfig: {
        "epi-mapping-engine": {
            module: "./../../epi-utils",
            function: "getEPIMappingEngineForAPIHUB",
            options: {
                walletSSI: "#validWalletSSIHere",
            },
        },
        "gtin-dsu-wizard": {
            module: "./../../gtin-dsu-wizard",
        },
        bricking: {},
        anchoring: {},
    },
    enableRequestLogger: true,
    enableJWTAuthorisation: false,
    enableLocalhostAuthorization: false,
    skipJWTAuthorisation: [
        "/assets",
        "/leaflet-wallet",
        "/dsu-fabric-wallet",
        "/directory-summary",
        "/resources",
        "/bdns",
        "/anchor/epi",
        "/anchor/default",
        "/anchor/vault",
        "/bricking",
        "/bricksFabric",
        "/create-channel",
        "/forward-zeromq",
        "/send-message",
        "/receive-message",
        "/files",
        "/notifications",
        "/mq",
    ],
};

assert.callback(
    "ConfigMigratorTest",
    async (testFinished) => {
        try {
            const folder = await $$.promisify(dc.createTestFolder)("test");
            const configFolderPath = path.join(folder, "/external-volume/config");
            await $$.promisify(fs.mkdir)(configFolderPath, { recursive: true });

            const serverJsonFilePath = path.join(configFolderPath, "server.json");
            await $$.promisify(fs.writeFile)(serverJsonFilePath, JSON.stringify(initialConfig));

            const apihubJsonFilePath = path.join(configFolderPath, "apihub.json");

            ConfigMigrator.migrate(initialConfig, configFolderPath);

            const apihubJson = JSON.parse(await $$.promisify(fs.readFile)(apihubJsonFilePath));

            // since the property values are arrays, neiter assert.objectHasFields nor assert.arraysMatch does a deep comparison
            assert.equal(JSON.stringify(expectedConfig), JSON.stringify(apihubJson));

            const availableDomains = [
                ...new Set([
                    ...Object.keys(initialConfig.endpointsConfig.anchoring.domainStrategies),
                    ...Object.keys(initialConfig.endpointsConfig.bricking.domains),
                ]).keys(),
            ];

            // check that each of the available domain has a separated config file
            availableDomains.forEach((domain) => {
                const domainConfigFilePath = path.join(configFolderPath, "domains", `${domain}.json`);
                fs.accessSync(domainConfigFilePath);
            });

            

            testFinished();
        } catch (error) {
            console.error(error);
        }
    },
    10000
);
