require("../../../../psknode/bundles/testsRuntime");
const testIntegration = require("../../../../psknode/tests/util/tir");

const fs = require("fs");
const path = require("path");

const dc = require("double-check");
const assert = dc.assert;

assert.callback(
    "DomainConfigPresent",
    async (testFinished) => {
        try {
            const serverConfig = {
                componentsConfig: {
                    anchoring: {
                        domainStrategies: {
                            test: {
                                type: "FS",
                                option: {
                                    path: "/internal-volume/domains/test/anchors",
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

            await testIntegration.launchConfigurableApiHubTestNodeAsync({
                serverConfig,
                domains: [{ name: "test", config: testDomainConfig }],
            });

            const apihub = require("apihub");
            // since the property values are arrays, neiter assert.objectHasFields nor assert.arraysMatch does a deep comparison

            const loadedAnchoringDomainConfig = apihub.getDomainConfig("test", "anchoring");
            assert.equal(
                JSON.stringify(testDomainConfig.anchoring),
                JSON.stringify(loadedAnchoringDomainConfig),
                "test domain anchoring config should match with domain config"
            );
            assert.equal(
                JSON.stringify(serverConfig.componentsConfig.anchoring.domainStrategies.test),
                JSON.stringify(loadedAnchoringDomainConfig),
                "test domain anchoring config should be present since fallback is provided"
            );

            const loadedBrickingDomainConfig = apihub.getDomainConfig("test", "bricking");
            assert.equal(
                JSON.stringify(testDomainConfig.bricking),
                JSON.stringify(loadedBrickingDomainConfig),
                "test domain bricking config should match with domain config"
            );
            assert.equal(
                JSON.stringify(serverConfig.componentsConfig.bricking.domains.test),
                JSON.stringify(loadedBrickingDomainConfig),
                "test domain bricking config should be present since fallback is provided"
            );

            const loadedBricksFabricDomainConfig = apihub.getDomainConfig("test", "bricksFabric");
            assert.equal(
                JSON.stringify(testDomainConfig.bricksFabric),
                JSON.stringify(loadedBricksFabricDomainConfig),
                "test domain bricksFabric config should match with domain config"
            );
            assert.equal(
                JSON.stringify(serverConfig.componentsConfig.bricksFabric.domainStrategies.test),
                JSON.stringify(loadedBricksFabricDomainConfig),
                "test domain bricksFabric config should be present since fallback is provided"
            );

            testFinished();
        } catch (error) {
            console.error(error);
        }
    },
    10000
);
