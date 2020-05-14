require("../../../../psknode/bundles/pskruntime");
require("../../../../psknode/bundles/psknode");
require("../../../../psknode/bundles/virtualMQ");

const assert           = require("double-check").assert;
const fileStateManager = require('../../../../libraries/utils/FileStateManager').getFileStateManager();
const VirtualMQ = require('virtualmq');
const path             = require('path');
require('psk-http-client');

var PORT = 9090;
const tempFolder = path.resolve('../../../tmp');
const CHANNEL_NAME = 'testChannel';
const swarmId = '26a4-01ba6a63a554';
const swarmDefinition = {
	meta: {
		swarmId: swarmId,
		requestId: swarmId,
		swarmTypeName: 'testSwarm',
		phaseName: 'testPhase',
		args: undefined,
		command: 'relay',
		target: 'agent\\agent_x'
	}
};

function createServer(callback) {
    var server = VirtualMQ.createPskWebServer(PORT, tempFolder, undefined, (err, res) => {
        if (err) {
            console.log("Failed to create VirtualMQ server on port ", PORT);
			console.log("Trying again...");
            if (PORT > 0 && PORT < 50000) {
                PORT++;
                createServer(callback);
            } else {
                console.log("There is no available port to start VirtualMQ instance need it for test!");
            }
        } else {
			console.log("Server ready and available on port ", PORT);
			let url = `http://127.0.0.1:${PORT}/${CHANNEL_NAME}`; 
			callback(server, url);
        }
    });
}

const flow = $$.flow.describe('VirtualMQTest', {
	init: function(callback) {
		this.cb = callback;

		fileStateManager.saveState([tempFolder], (err) => {
			assert.false(err, 'Saving state has failed');
			createServer( (server, url) => {
				this.url = url; 
				this.sendSwarm(() => {
					this.getSwarm(() => {
						setTimeout(() => {
							this.sendSwarm(() => {
								server.close();
								fileStateManager.restoreState();
								this.cb();
							})
						}, 100);
					});
				});
			});
		});
	},
	sendSwarm: function(callback) {
		$$.remote.doHttpPost(this.url, JSON.stringify(swarmDefinition), (err, data) => {
			assert.false(err, 'Posting swarm failed ' + (err ? err.message : ''));
			callback();
		});
	},
	getSwarm: function(callback) {
		$$.remote.doHttpGet(this.url, (err, data) => {
			assert.false(err, 'Getting swarm has failed');
			callback();
		});
	}
})();

assert.callback("VirtualMQTest", function (callback) {
	flow.init(callback);
}, 1500);

