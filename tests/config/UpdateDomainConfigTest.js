require("../../../../psknode/bundles/testsRuntime");
const testIntegration = require("../../../../psknode/tests/util/tir");

const fs = require("fs");
const path = require("path");
const http = require("http");

const dc = require("double-check");
const assert = dc.assert;

function updateDomainConfigFromApihub(port, domain, config, callback) {
    const options = {
        host: "localhost",
        port,
        path: `/config/${domain}`,
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
    };
    const req = http.request(options, async (res) => {
        assert.true(res.statusCode === 200, "Response error");
        callback();
    });

    req.on("error", (e) => {
        assert.true(false, "Problem with request");
        callback(e);
    });

    req.write(JSON.stringify(config));
    req.end();
}

function getDomainConfigFromApihub(port, domain, callback) {
    const options = {
        host: "localhost",
        port,
        path: `/config/${domain}`,
        method: "GET",
    };

    const request = http.request(options, async (getResponse) => {
        assert.true(getResponse.statusCode === 200, "Response error");
        let data = "";
        getResponse.setEncoding("utf8");

        getResponse.on("data", function (chunk) {
            data += chunk;
        });

        getResponse.on("end", async () => {
            data = await JSON.parse(data);
            callback(null, data);
        });
    });

    request.on("error", (e) => {
        assert.true(false, "Problem with request");
        callback(e);
    });
    request.end();
}

assert.callback(
    "UpdateDomainConfigTest",
    async (testFinished) => {
        try {
            const domain = "test";
            const folder = await $$.promisify(dc.createTestFolder)("dsu");
            const domainsConfigPath = path.join(folder, "/external-volume/config/domains");

            const initialDomainConfig = {
                anchoring: "dummy",
                bricking: "dummy",
                bricksFabric: "dummy",
            };

            const expectedDomainConfig = {
                anchoring: {
                    type: "FS",
                    option: {
                        path: "/internal-volume/domains/test/anchors",
                        enableBricksLedger: false,
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
            await $$.promisify(testIntegration.storeFile)(
                domainsConfigPath,
                `${domain}.json`,
                JSON.stringify(initialDomainConfig)
            );
            await $$.promisify(testIntegration.storeServerConfig)(folder, {});
            const port = await $$.promisify(testIntegration.launchApiHubTestNode)(10, folder);

            const firstDomainConfigResponse = await $$.promisify(getDomainConfigFromApihub)(port, domain);
            assert.objectHasFields(firstDomainConfigResponse, initialDomainConfig);

            await $$.promisify(updateDomainConfigFromApihub)(port, domain, expectedDomainConfig);

            const updatedDomainConfigResponse = await $$.promisify(getDomainConfigFromApihub)(port, domain);
            // since the property values are arrays, neiter assert.objectHasFields nor assert.arraysMatch does a deep comparison
            assert.equal(JSON.stringify(updatedDomainConfigResponse), JSON.stringify(expectedDomainConfig));

            try {
                fs.accessSync(path.join(folder, "/external-volume/config/server.json"));
                assert.true(false, "should delete server.json file after migration");
            } catch (error) {
                console.log(error);
                assert.notNull(error);
            }

            testFinished();
        } catch (error) {
            console.error(error);
        }
    },
    10000
);
