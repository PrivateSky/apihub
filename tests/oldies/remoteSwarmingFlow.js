require("../../../../psknode/bundles/pskruntime");
require("callflow");
require('../../flows/remoteSwarming');
require("../../../../psknode/bundles/pskruntime");
const assert           = require("double-check").assert;
const path             = require('path');
const Duplex           = require('stream').Duplex;
const fileStateManager = require('../../../../libraries/utils/FileStateManager').getFileStateManager();

const CHANNEL_ID = '123';
const tempFolder = path.resolve('../../../tmp');

const flow = $$.flow.describe('RemoteSwarmingFlowTest', {
	init: function (callback) {
		this.cb = callback;
		fileStateManager.saveState([tempFolder], () => {
			this.remoteSwarmingFlow = $$.flow.describe('RemoteSwarming');
			this.remoteSwarmingFlow.init(tempFolder, (err) => {
				assert.false(err, 'Error initializing RemoteSwarming');
				this.startSwarm(() => {
					this.waitForSwarm(() => {
						this.waitForSwarm(() => {
							this.cb();
						});
						setTimeout(() => {
							this.startSwarm(() => {})
						}, 100);
					});
				});
			});
		});
	},
	startSwarm: function (callback) {
		const swarmBuffer = $$.Buffer.from(JSON.stringify(swarmDefinition));
		this.remoteSwarmingFlow.startSwarm(CHANNEL_ID, bufferToStream(swarmBuffer), (err, result) => {
			assert.false(err, 'Starting swarm has failed ');
			callback();
		})
	},
	waitForSwarm: function (callback) {
		const duplex = new Duplex();
		duplex._write = () => {};
		this.remoteSwarmingFlow.waitForSwarm(CHANNEL_ID, duplex, (err, data, confirmationId) => {
			assert.false(err, 'Waiting for swarm was not successful ');
			assert.equal(JSON.stringify(data), JSON.stringify(swarmDefinition), "Received swarm doesn't match the sent one");
			this.remoteSwarmingFlow.confirmSwarm(CHANNEL_ID, confirmationId, (err) => {
				assert.false(err, 'Confirming swarm has failed');
				callback();
			});
		});
	}
})();

assert.callback("RemoteSwarmingFlowTest", function (callback) {
	flow.init(callback);
}, 1500);


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

function bufferToStream(buffer) {
	const stream = new Duplex();
	stream.push(buffer);
	stream.push(null);
	return stream;
}