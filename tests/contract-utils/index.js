require("../../../../psknode/bundles/testsRuntime");
const testIntegration = require("../../../../psknode/tests/util/tir");

const path = require("path");

const openDSU = require("opendsu");
const http = openDSU.loadApi("http");

const domain = "default";

async function launchApiHubTestNodeWithDefaultContractAsync(contractConfig, config) {
    config = config || {};
    if (contractConfig) {
        config.domains = [{ name: domain, config: { contracts: contractConfig } }];
    }
    return testIntegration.launchApiHubTestNodeWithContractAsync(path.resolve(__dirname, "bin/build.file"), config);
}

async function callNodeEndpointAsync(url) {
    const response = await http.fetch(url);
    const json = await response.json();
    return json;
}

async function getAnchorVersions(nodeUrl, anchorId) {
    const versionsResponse = await http.fetch(`${nodeUrl}/anchor/${domain}/get-all-versions/${anchorId}`);
    const versions = await versionsResponse.json();
    return versions || [];
}

async function getBrick(nodeUrl, hashLink) {
    const brickResponse = await http.fetch(`${nodeUrl}/bricking/${domain}/get-brick/${hashLink}`);
    const brick = await brickResponse.text();
    return brick.toString();
}

module.exports = {
    launchApiHubTestNodeWithDefaultContractAsync,
    callNodeEndpointAsync,
    getAnchorVersions,
    getBrick
};
