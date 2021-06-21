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
            const folder = await $$.promisify(dc.createTestFolder)("dsu");
            const configFolderPath = path.join(folder, "/external-volume/config");
            const domainsConfigPath = path.join(configFolderPath, "domains");

            await $$.promisify(testIntegration.storeFile)(domainsConfigPath, "domain1.json", "{}");
            await $$.promisify(testIntegration.storeFile)(domainsConfigPath, "domain2.json", "{}");
            await $$.promisify(testIntegration.storeFile)(domainsConfigPath, "domain3.json", "{}");

            // set config environment variable, which is set automatically when apihub is started
            process.env.PSK_CONFIG_LOCATION = configFolderPath;

            const configuredDomains = config.getConfiguredDomains();
            assert.arraysMatch(configuredDomains, ["domain1", "domain2", "domain3"]);

            testFinished();
        } catch (error) {
            console.error(error);
        }
    },
    10000
);
