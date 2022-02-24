require('../../../../psknode/bundles/testsRuntime');
const assert = require('double-check').assert;
const dc = require("double-check");
const tir = require("../../../../psknode/tests/util/tir");
const openDSU = require("opendsu");
const http = openDSU.loadApi("http");
const doPut = $$.promisify(http.doPut);


const  utils =  require('./utils');

assert.callback('Should append anchor multiple times test', async (callback) => {

    dc.createTestFolder('createDSU', async (err, folder) => {
        const vaultDomainConfig = {
            "anchoring": {
                "type": "FSX",
                "option": {}
            }
        }
        const domain = 'default';
        const apiHub = await tir.launchConfigurableApiHubTestNodeAsync({domains: [{name: "default", config: vaultDomainConfig}]});
        console.log(apiHub);
        const seedSSI = utils.generateSeedSSI();
        const anchorId = utils.getAnchorId(seedSSI);
        const hashlink = await utils.getSignedHashLink(seedSSI,null);
        const hashlink2 = await utils.getSignedHashLink(seedSSI,hashlink);
        const hashlink3 = await utils.getSignedHashLink(seedSSI,hashlink2);
        const hashlink4 = await utils.getSignedHashLink(seedSSI,hashlink3);
        const mainNodeUrl =  apiHub.url;

        await $$.promisify(doPut)(`${mainNodeUrl}/anchor/${domain}/create-anchor/${anchorId}`, {"hashLinkSSI" : hashlink},async (err) =>{
            assert.true(typeof err === 'undefined');

            await $$.promisify(doPut)(`${mainNodeUrl}/anchor/${domain}/append-to-anchor/${anchorId}`, {"hashLinkSSI" : hashlink2}, async (err) =>{
                assert.true(typeof err === 'undefined');
                await $$.promisify(doPut)(`${mainNodeUrl}/anchor/${domain}/append-to-anchor/${anchorId}`, {"hashLinkSSI" : hashlink3}, async (err) => {
                    assert.true(typeof err === 'undefined');
                    await $$.promisify(doPut)(`${mainNodeUrl}/anchor/${domain}/append-to-anchor/${anchorId}`, {"hashLinkSSI" : hashlink4}, async (err) => {
                        assert.true(typeof err === 'undefined');

                        const fetch = await http.fetch(`${mainNodeUrl}/anchor/${domain}/get-all-versions/${anchorId}`);
                        const response = await fetch;
                        assert.false(response.statusCode !== 200 && response.statusCode !== 201);
                        const versions = await response.json();
                        assert.true(versions.length === 4);
                        assert.true(versions[0] === hashlink);
                        assert.true(versions[1] === hashlink2);
                        assert.true(versions[2] === hashlink3);
                        assert.true(versions[3] === hashlink4);

                        callback();
                    });
                });

            });
        });
    })
}, 5000)

