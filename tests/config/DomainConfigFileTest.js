require("../../../../psknode/bundles/testsRuntime");
const testIntegration = require("../../../../psknode/tests/util/tir");

const fs = require("fs");
const path = require("path");

const dc = require("double-check");
const assert = dc.assert;

assert.callback(
    "DomainConfigFileTest",
    async (testFinished) => {
        try {
            const folder = await $$.promisify(dc.createTestFolder)("dsu");
            const domainsConfigPath = path.join(folder, "/external-volume/config/domains");

            serverConfig = {};

            const testDomainConfig = {
                anchoring: {
                    type: "FS",
                    option: {
                        path: "/internal-volume/domains/test/anchors",
                    },
                    commands: {
                        addAnchor: "anchor",
                    },
                },
                bricking: {
                    path: "/internal-volume/domains/test/brick-storage",
                },
                bricksFabric: {
                    name: "BrickStorage",
                    option: {
                        timeout: 15000,
                        transactionsPerBlock: 5,
                    },
                },
            };
            await $$.promisify(testIntegration.storeFile)(domainsConfigPath, "test.json", JSON.stringify(testDomainConfig));
            await $$.promisify(testIntegration.storeServerConfig)(folder, serverConfig);
            await $$.promisify(testIntegration.launchApiHubTestNode)(10, folder);

            const apihub = require("apihub");

            const loadedtestDomainConfig = apihub.getDomainConfig("test");

            // since the property values are arrays, neiter assert.objectHasFields nor assert.arraysMatch does a deep comparison
            assert.equal(JSON.stringify(loadedtestDomainConfig), JSON.stringify(testDomainConfig));

            testFinished();
        } catch (error) {
            console.error(error);
        }
    },
    10000
);
