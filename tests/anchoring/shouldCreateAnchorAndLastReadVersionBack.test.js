require('../../../../psknode/bundles/testsRuntime');
const assert = require('double-check').assert;
const dc = require("double-check");
const tir = require("../../../../psknode/tests/util/tir");
const openDSU = require("opendsu");
const http = openDSU.loadApi("http");
const doPut = $$.promisify(http.doPut);


const  utils =  require('./utils');

assert.callback('Should Create anchor and read version back test', async (callback) => {

    dc.createTestFolder('createDSU', async (err, folder) => {
        const vaultDomainConfig = {
            "anchoring": {
                "type": "FSX",
                "option": {}
            }
        }
        const domain = 'default';
        const apiHub = await tir.launchConfigurableApiHubTestNodeAsync({domains: [{name: "default", config: vaultDomainConfig}]});
        const seedSSI = utils.generateSeedSSI();
        const anchorId = await utils.getAnchorId(seedSSI);
        const hashlink = await utils.getSignedHashLink(seedSSI,null);

        const mainNodeUrl =  apiHub.url;

        await $$.promisify(doPut)(`${mainNodeUrl}/anchor/${domain}/create-anchor/${anchorId}`, {"hashLinkSSI" : hashlink},async (err) =>{
            assert.true(typeof err === 'undefined');

            const fetch = await http.fetch(`${mainNodeUrl}/anchor/${domain}/get-last-version/${anchorId}`);
            const response = await fetch;
            assert.false(response.statusCode !== 200 && response.statusCode !== 201 );
            const version = await response.json();
            assert.true(version.message === hashlink);
            callback();

        });
    })
}, 5000)

