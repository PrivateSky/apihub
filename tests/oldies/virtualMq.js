require("../../../../psknode/bundles/pskruntime");
require("../../../../psknode/bundles/psknode");
const assert           = require("double-check").assert;
const fileStateManager = require('../../../../libraries/utils/FileStateManager').getFileStateManager();
const VirtualMQ        = require('../../index');
const path             = require('path');
require('psk-http-client');

const PORT = 9500;
const tempFolder = path.resolve('../../../../tmp');
const CHANNEL_NAME = 'testChannel';
const url = `http://127.0.0.1:${PORT}/${CHANNEL_NAME}`;

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
var nrofSentWarms=0;
var nrOfReceivedSwarms=0;

const flow = $$.flow.describe('VirtualMQTest', {
	init: function(callback) {
		this.cb = callback;

		fileStateManager.saveState([tempFolder], (err) => {
			assert.false(err, 'Saving state has failed');
			this.virtualMq = VirtualMQ.createVirtualMQ(PORT, tempFolder, () => {
				this.sendSwarm(() => {
					this.getSwarm(()=>{
						setTimeout(() => {
							this.sendSwarm(() => {
								this.getSwarm(()=>{
									setTimeout(() => {
										this.sendSwarm(() => {
											this.getSwarm(()=>{
												this.virtualMq.close();
												fileStateManager.restoreState();
												this.cb();
												console.log('************   '+ nrofSentWarms)
												console.log('------------   '+ nrOfReceivedSwarms)
											});
										})
								}, 100);
								});
							})
						}, 100);
					});
				});
			});
		});
	},
	sendSwarm: function(callback) {
		$$.remote.doHttpPost(url, JSON.stringify(swarmDefinition), (err, data) => {
			assert.false(err, 'Posting swarm failed ' + (err ? err.message : ''));
			if(!err){
				nrofSentWarms++;
			}
			assert.true(3, nrofSentWarms, 'The no of sent swarms is not as expected');
			callback();
		});
		//console.log('***********   '+nrofSentWarms)
	},
	getSwarm: function(callback) {
		$$.remote.doHttpGet(url, (err, data) => {
			assert.false(err, 'Getting swarm has failed'+ (err ? err.message : ''));
			if(!err){
				nrOfReceivedSwarms++;
			}
			assert.true(1, nrOfReceivedSwarms, 'The no of received swarms is not as expected');
			callback();
		});
		//console.log('------------   '+ nrOfReceivedSwarms)
	}
})();

assert.callback("VirtualMQ Test Swarm Operations", function (callback) {
	flow.init(callback);
}, 300);

