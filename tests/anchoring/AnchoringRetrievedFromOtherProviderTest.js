require("../../../../psknode/bundles/testsRuntime");
const testIntegration = require("../../../../psknode/tests/util/tir");
const dc = require("double-check");
const { assert } = dc;

const { launchApiHubTestNodeWithDefaultContractAsync } = require("../contract-utils");

const openDSU = require("opendsu");
const keySSIApi = openDSU.loadApi("keyssi");
const http = openDSU.loadApi("http");
const doPut = $$.promisify(http.doPut);

const domain = "default";

async function getAnchorVersions(nodeUrl, anchorId) {
    const versionsResponse = await http.fetch(`${nodeUrl}/anchor/${domain}/get-all-versions/${anchorId}`);
    const versions = await versionsResponse.json();
    return versions || [];
}

assert.callback(
    "Anchors and bricks resolved from other anchoring/bricking providers than self",
    async (testFinished) => {
        const seedSSI = keySSIApi.createSeedSSI(domain);
        const anchorId = seedSSI.getAnchorId();

        const timestamp = Date.now();
        let dataToSign = `${timestamp}${anchorId}`;

        const signature = await $$.promisify(seedSSI.sign)(dataToSign);
        const signedHashLinkSSI = keySSIApi.createSignedHashLinkSSI(domain, "HASH1", timestamp, signature, seedSSI.getVn());

        const mainNode = await launchApiHubTestNodeWithDefaultContractAsync(null, {
            useWorker: true,
        });
        const mainNodeUrl = mainNode.url;
        const contractConstitution = mainNode.contractConstitution;

        const secondNode = await testIntegration.launchConfigurableApiHubTestNodeAsync({
            useWorker: true,
            domains: [{ name: domain, config: { contracts: { constitution: contractConstitution } } }],
        });
        const secondNodeUrl = secondNode.url;

        const thirdNode = await testIntegration.launchConfigurableApiHubTestNodeAsync({
            useWorker: true,
            domains: [{ name: domain, config: { contracts: { constitution: contractConstitution } } }],
            onPortAquired: (port, options) => {
                const nodeUrl = `http://localhost:${port}`;
                options.bdns = {
                    default: {
                        replicas: [],
                        notifications: [nodeUrl],
                        brickStorages: [nodeUrl],
                        anchoringServices: [nodeUrl, mainNodeUrl],
                        contractServices: [nodeUrl],
                        validators: [{ DID: "did:demo:id-2", URL: nodeUrl }],
                    },
                };
            },
        });
        const thirdNodeUrl = thirdNode.url;

        let mainNodeVersions = await getAnchorVersions(mainNodeUrl, anchorId);
        assert.arraysMatch(mainNodeVersions, []);

        let secondNodeVersions = await getAnchorVersions(secondNodeUrl, anchorId);
        assert.arraysMatch(secondNodeVersions, []);

        let thirdNodeVersions = await getAnchorVersions(thirdNodeUrl, anchorId);
        assert.arraysMatch(thirdNodeVersions, []);

        await $$.promisify(doPut)(`${mainNodeUrl}/anchor/${domain}/create-anchor/${anchorId}`, {});
        await $$.promisify(doPut)(`${mainNodeUrl}/anchor/${domain}/append-to-anchor/${anchorId}`, {
            hashLinkIds: {
                last: null,
                new: signedHashLinkSSI.getIdentifier(),
            },
        });

        const expectedVersions = [signedHashLinkSSI.getIdentifier()];

        mainNodeVersions = await getAnchorVersions(mainNodeUrl, anchorId);
        assert.arraysMatch(mainNodeVersions, expectedVersions);

        secondNodeVersions = await getAnchorVersions(secondNodeUrl, anchorId);
        assert.arraysMatch(secondNodeVersions, [], "Expected to have no versions since main provider is not present");

        thirdNodeVersions = await getAnchorVersions(thirdNodeUrl, anchorId);
        console.log("thirdNodeVersions", thirdNodeVersions);
        assert.arraysMatch(thirdNodeVersions, expectedVersions, "Expected to have the same versions as main provider");

        testFinished();
    },
    20000
);
