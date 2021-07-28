require("../../../../psknode/bundles/testsRuntime");
const testIntegration = require("../../../../psknode/tests/util/tir");
const dc = require("double-check");
const { assert } = dc;

const { launchApiHubTestNodeWithDefaultContractAsync, getAnchorVersions, getBrick } = require("../contract-utils");

const openDSU = require("opendsu");
const keySSIApi = openDSU.loadApi("keyssi");
const contractsApi = openDSU.loadApi("contracts");
const http = openDSU.loadApi("http");
const doPut = $$.promisify(http.doPut);

const domain = "default";

assert.callback(
    "Anchoring/bricking retrieved when two nodes point to each other for anchoring/bricking external providers avoiding circular loops using contract BDNS updates",
    async (testFinished) => {
        const seedSSI = keySSIApi.createSeedSSI(domain);
        const anchorId = seedSSI.getAnchorId();
        const brickData = "BRICK_DATA";

        const timestamp = Date.now();
        let dataToSign = `${timestamp}${anchorId}`;

        const signature = await $$.promisify(seedSSI.sign)(dataToSign);
        const signedHashLinkSSI = keySSIApi.createSignedHashLinkSSI(domain, "HASH1", timestamp, signature, seedSSI.getVn());

        const mainNodePort = await testIntegration.getRandomAvailablePortAsync();
        const mainNodeUrl = `http://localhost:${mainNodePort}`;

        const secondNodePort = await testIntegration.getRandomAvailablePortAsync();
        const secondNodeUrl = `http://localhost:${secondNodePort}`;

        const mainNode = await launchApiHubTestNodeWithDefaultContractAsync(null, {
            useWorker: true,
            port: mainNodePort,
        });
        const contractConstitution = mainNode.contractConstitution;

        const secondNode = await testIntegration.launchConfigurableApiHubTestNodeAsync({
            useWorker: true,
            generateValidatorDID: true,
            port: secondNodePort,
            domains: [{ name: domain, config: { contracts: { constitution: contractConstitution } } }],
            bdns: {
                default: {
                    replicas: [],
                    notifications: [mainNodeUrl],
                    brickStorages: [mainNodeUrl, secondNodeUrl],
                    anchoringServices: [mainNodeUrl, secondNodeUrl],
                    contractServices: [mainNodeUrl],
                    validators: [{ DID: "did:demo:id-1", URL: mainNodeUrl }],
                },
            },
        });

        await $$.promisify(doPut)(`${mainNodeUrl}/anchor/${domain}/create-anchor/${anchorId}`, {});
        await $$.promisify(doPut)(`${mainNodeUrl}/anchor/${domain}/append-to-anchor/${anchorId}`, {
            hashLinkIds: {
                last: null,
                new: signedHashLinkSSI.getIdentifier(),
            },
        });
        const brickResponse = await $$.promisify(doPut)(`${mainNodeUrl}/bricking/${domain}/put-brick/`, brickData);
        const brickHashLink = JSON.parse(brickResponse).message;

        const expectedVersions = [signedHashLinkSSI.getIdentifier()];

        const generateNoncedCommand = $$.promisify(contractsApi.generateNoncedCommandForSpecificServer);

        const updatedMainNodeBdsn = {
            replicas: [],
            notifications: [mainNodeUrl],
            brickStorages: [mainNodeUrl, secondNodeUrl],
            anchoringServices: [mainNodeUrl, secondNodeUrl],
            contractServices: [mainNodeUrl],
            validators: [{ DID: "did:demo:id-0", URL: mainNodeUrl }],
        };
        await generateNoncedCommand(mainNodeUrl, mainNode.validatorDID, domain, "bdns", "updateDomainInfo", [
            updatedMainNodeBdsn,
        ]);

        const updatedSecondNodeBdsn = {
            replicas: [],
            notifications: [secondNodeUrl],
            brickStorages: [secondNodeUrl, mainNodeUrl],
            anchoringServices: [secondNodeUrl, mainNodeUrl],
            contractServices: [secondNodeUrl],
            validators: [{ DID: "did:demo:id-1", URL: secondNodeUrl }],
        };
        await generateNoncedCommand(secondNodeUrl, secondNode.validatorDID, domain, "bdns", "updateDomainInfo", [
            updatedSecondNodeBdsn,
        ]);

        let mainNodeVersions = await getAnchorVersions(mainNodeUrl, anchorId);
        assert.arraysMatch(mainNodeVersions, expectedVersions);

        let mainNodeBrickData = await getBrick(mainNodeUrl, brickHashLink);
        assert.equal(mainNodeBrickData, brickData);

        let secondNodeVersions = await getAnchorVersions(secondNodeUrl, anchorId);
        assert.arraysMatch(secondNodeVersions, expectedVersions, "Expected to have same versions as main provider");

        let secondNodeBrickData = await getBrick(secondNodeUrl, brickHashLink);
        assert.equal(secondNodeBrickData, brickData, "Expected to have same brick data as main provider");

        testFinished();
    },
    60000
);
