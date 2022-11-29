require("../../../../psknode/bundles/testsRuntime");
const tir = require("../../../../psknode/tests/util/tir");

const dc = require("double-check");
const assert = dc.assert;
const openDSU = require('../../../opendsu');
$$.__registerModule("opendsu", openDSU);
const scAPI = openDSU.loadApi("sc");
const w3cDID = openDSU.loadAPI("w3cdid");
const http = openDSU.loadApi("http");
const enclaveAPI = openDSU.loadApi("enclave");
const doPost = $$.promisify(http.doPost);


assert.callback('Create enclave test', (testFinished) => {
    dc.createTestFolder('createDSU', async (err, folder) => {
        const testDomainConfig = {
            "anchoring": {
                "type": "FS",
                "option": {}
            },
            "enable": ["enclave", "mq"]
        }

        const domain = "testDomain"
        const apiHub = await tir.launchConfigurableApiHubTestNodeAsync({ domains: [{ name: domain, config: testDomainConfig }] });
        const sc = scAPI.getSecurityContext();

        sc.on("initialised", async () => {
            try {
                const adminDIDDocument = await $$.promisify(w3cDID.createIdentity)("key", domain, "some secret");
                const documentIdentifier = adminDIDDocument.getIdentifier();
                const url = `${apiHub.url}/enclave/create-enclave/${documentIdentifier}`;

                const enclaveDID = await doPost(url, {});
                assert.true(enclaveDID.substring(0, 7) == 'did:key');

                remoteDIDDocument = await $$.promisify(w3cDID.resolveDID)(enclaveDID);
                const remoteEnclave = enclaveAPI.initialiseRemoteEnclave(adminDIDDocument.getIdentifier(), remoteDIDDocument.getIdentifier());
                
                const TABLE = "test_table";
                const addedRecord = { data: 1 };
                remoteEnclave.on("initialised", async () => {
                    try {
                        await $$.promisify(remoteEnclave.insertRecord)("some_did", TABLE, "pk1", addedRecord, addedRecord);
                        await $$.promisify(remoteEnclave.insertRecord)("some_did", TABLE, "pk2", addedRecord, addedRecord);
                        const record = await $$.promisify(remoteEnclave.getRecord)("some_did", TABLE, "pk1");
                        assert.objectsAreEqual(record, addedRecord, "Records do not match");
                        const allRecords = await $$.promisify(remoteEnclave.getAllRecords)("some_did", TABLE);

                        assert.equal(allRecords.length, 2, "Not all inserted records have been retrieved")
                        testFinished();
                    } catch (e) {
                        return console.log(e);
                    }

                });

            } catch (e) {
                return console.log(e);
            }
        })
    });
}, 500000);
