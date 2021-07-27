require("../../../../psknode/bundles/testsRuntime");
const testIntegration = require("../../../../psknode/tests/util/tir");
const dc = require("double-check");
const { assert } = dc;

const { launchApiHubTestNodeWithDefaultContractAsync, callNodeEndpointAsync } = require("../contract-utils");

const domain = "default";

assert.callback(
    "Boot validator without deploying it's own constract constitution, but instead using other node's constitution",
    async (testFinished) => {
        const mainNode = await launchApiHubTestNodeWithDefaultContractAsync(null, {
            useWorker: true,
        });
        const mainNodeUrl = mainNode.url;
        const contractConstitution = mainNode.contractConstitution;

        const secondNode = await testIntegration.launchConfigurableApiHubTestNodeAsync({
            useWorker: true,
            generateValidatorDID: true,
            domains: [{ name: domain, config: { contracts: { constitution: contractConstitution } } }],
            onPortAquired: (port, options) => {
                const nodeUrl = `http://localhost:${port}`;
                options.bdns = {
                    default: {
                        replicas: [],
                        notifications: [nodeUrl],
                        brickStorages: [nodeUrl, mainNodeUrl],
                        anchoringServices: [nodeUrl, mainNodeUrl],
                        contractServices: [nodeUrl],
                        validators: [{ DID: "did:demo:id-1", URL: nodeUrl }],
                    },
                };
            },
        });

        // expecting to be able to call contract methods even though the second node hasn't deployed its own contract constitution
        const latestBlockInfo = await callNodeEndpointAsync(`${secondNode.url}/contracts/${domain}/latest-block-info`);
        assert.notNull(latestBlockInfo);
        assert.equal(latestBlockInfo.number, 0);
        assert.isNull(latestBlockInfo.hash);

        testFinished();
    },
    60000
);
