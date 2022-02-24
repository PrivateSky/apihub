require('../../../../psknode/bundles/testsRuntime');
const assert = require('double-check').assert;
const dc = require("double-check");
const tir = require("../../../../psknode/tests/util/tir");
const openDSU = require("opendsu");
const http = openDSU.loadApi("http");


const  utils =  require('./utils');

assert.callback('Should get null or empty array version for non existing anchors', async (callback) => {

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
        const anchorId = utils.getAnchorId(seedSSI);

        const mainNodeUrl =  apiHub.url;

        const fetch = await http.fetch(`${mainNodeUrl}/anchor/${domain}/get-all-versions/${anchorId}`);
        const response = await fetch;
        assert.false(response.statusCode !== 200 && response.statusCode !== 201 );
        const versions = await response.json();
        assert.true(versions.length === 0);
        callback();
    })
}, 5000)

