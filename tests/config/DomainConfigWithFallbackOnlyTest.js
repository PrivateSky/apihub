require("../../../../psknode/bundles/testsRuntime");
const testIntegration = require("../../../../psknode/tests/util/tir");

const fs = require("fs");
const path = require("path");

const dc = require("double-check");
const assert = dc.assert;

assert.callback(
    "DomainConfigWithFallbackOnlyTest",
    async (testFinished) => {
        try {
            const folder = await $$.promisify(dc.createTestFolder)("dsu");

            const serverConfig = {
                endpointsConfig: {
                    anchoring: {
                        domainStrategies: {
                            test: {
                                type: "FS",
                                option: {
                                    path: "/internal-volume/domains/test/anchors",
                                    enableBricksLedger: false,
                                },
                                commands: {
                                    addAnchor: "anchor",
                                },
                            },
                        },
                    },
                    bricking: {
                        domains: {
                            test: {
                                path: "/internal-volume/domains/test/brick-storage",
                            },
                        },
                    },
                    bricksFabric: {
                        domainStrategies: {
                            test: {
                                name: "BrickStorage",
                                option: {
                                    timeout: 15000,
                                    transactionsPerBlock: 5,
                                },
                            },
                        },
                    },
                },
            };

            await $$.promisify(testIntegration.storeServerConfig)(folder, serverConfig);
            await $$.promisify(testIntegration.launchApiHubTestNode)(10, folder);

            const apihub = require("apihub");

            const loadedTestDomainConfig = apihub.getDomainConfig("test");
            assert.true(loadedTestDomainConfig == null, "test domain config should be empty since no fallback is specified");

            const loadedAnchoringDomainConfigWithFallback = apihub.getDomainConfig(
                "test",
                [],
                ["endpointsConfig", "anchoring", "domainStrategies"]
            );
            assert.equal(
                JSON.stringify(serverConfig.endpointsConfig.anchoring.domainStrategies.test),
                JSON.stringify(loadedAnchoringDomainConfigWithFallback),
                "test domain anchoring config should be present since fallback is provided"
            );

            const loadedBrickingDomainConfigWithFallback = apihub.getDomainConfig(
                "test",
                [],
                ["endpointsConfig", "bricking", "domains"]
            );
            assert.equal(
                JSON.stringify(serverConfig.endpointsConfig.bricking.domains.test),
                JSON.stringify(loadedBrickingDomainConfigWithFallback),
                "test domain bricking config should be present since fallback is provided"
            );

            const loadedBricksFabricDomainConfigWithFallback = apihub.getDomainConfig(
                "test",
                [],
                ["endpointsConfig", "bricksFabric", "domainStrategies"]
            );
            assert.equal(
                JSON.stringify(serverConfig.endpointsConfig.bricksFabric.domainStrategies.test),
                JSON.stringify(loadedBricksFabricDomainConfigWithFallback),
                "test domain bricksFabric config should be present since fallback is provided"
            );

            // since the property values are arrays, neiter assert.objectHasFields nor assert.arraysMatch does a deep comparison

            testFinished();
        } catch (error) {
            console.error(error);
        }
    },
    10000
);
