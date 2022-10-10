require('../../../../psknode/bundles/testsRuntime');
const assert = require('double-check').assert;
const dc = require("double-check");
const tir = require("../../../../psknode/tests/util/tir");
const openDSU = require("opendsu");
const http = openDSU.loadApi("http");
const doPut = $$.promisify(http.doPut);


const  utils =  require('./utils');

assert.callback('Should create new anchor of type CZA and read versions back', async (callback) => {

        dc.createTestFolder('createDSU', async (err, folder) => {
                const vaultDomainConfig = {
                        "anchoring": {
                                "type": "FSX",
                                "option": {}
                        }
                }
                const domain = 'default';
                const apiHub = await tir.launchConfigurableApiHubTestNodeAsync({domains: [{name: "default", config: vaultDomainConfig}]});
                const constSSI = utils.generateConstSSI();
                const anchorId = await utils.getAnchorId(constSSI);
                const hashlink = await utils.getHashLink(constSSI);

                const mainNodeUrl =  apiHub.url;

                await $$.promisify(doPut)(`${mainNodeUrl}/anchor/${domain}/create-anchor/${anchorId}`, {"hashLinkSSI" : hashlink},async (err) =>{
                        assert.true(typeof err === 'undefined');

                        const fetch = await http.fetch(`${mainNodeUrl}/anchor/${domain}/get-all-versions/${anchorId}`);
                        const response = await fetch;
                        assert.false(response.statusCode !== 200 && response.statusCode !== 201 );
                        const versions = await response.json();
                        assert.true(versions.length === 1);
                        assert.true(versions[0] === hashlink);
                        callback();
                });
        })
}, 5000)

