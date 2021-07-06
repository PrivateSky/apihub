require("../../../../psknode/bundles/testsRuntime");
const testIntegration = require("../../../../psknode/tests/util/tir");

const path = require("path");

const dc = require("double-check");
const config = require("../../config");
const assert = dc.assert;

assert.callback(
    "GetConfiguredDomainsTest",
    async (testFinished) => {
        try {
            await testIntegration.launchConfigurableApiHubTestNodeAsync({
                domains: [
                    { name: "domain1", config: {} },
                    { name: "domain2", config: {} },
                    { name: "domain3", config: {} },
                ],
                includeDefaultDomains: false,
            });

            const configuredDomains = config.getConfiguredDomains();
            assert.arraysMatch(configuredDomains, ["domain1", "domain2", "domain3"]);

            testFinished();
        } catch (error) {
            console.error(error);
        }
    },
    10000
);
