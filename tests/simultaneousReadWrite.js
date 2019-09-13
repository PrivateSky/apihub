require("../../../psknode/bundles/pskruntime");
const assert           = require("double-check").assert;
const fileStateManager = require('../../../libraries/utils/FileStateManager').getFileStateManager();
const VirtualMQ        = require('virtualmq');
const path             = require('path');
const fs               = require('fs');
require('psk-http-client');

const PORT = 9090;
const tempFolder = path.resolve('../../../tmp');
const CHANNEL_NAME = 'testChannel';
const url = `http://127.0.0.1:${PORT}/${CHANNEL_NAME}`;
const NUMBER_OF_SWARMS = 30;

let receivedSwarms = 0;
let sentSwarms = 0;

const swarmIds = {};

const flow = $$.flow.describe('simultaneousReadWrite', {
	init: function (callback) {
		this.cb = callback;

		fileStateManager.saveState([tempFolder], (err) => {
			// assert.false(err, 'Saving state has failed');
			this.virtualMq = VirtualMQ.createVirtualMQ(PORT, tempFolder, () => {
				this.sendSwarms();
				this.getSwarms();
				setTimeout(this.checkResults, 6500);
			});
		});
	},
	__sendSwarm: function (callback) {
		$$.uidGenerator.safe_uuid(function(err, uid) {
			if(!err) {
				const swarm = JSON.parse(JSON.stringify(swarmDefinition));
				swarm.meta.swarmId = uid;
				swarm.meta.requestId = uid;

				$$.remote.doHttpPost(url, JSON.stringify(swarm), (err, data) => {
					assert.false(err, 'Posting swarm failed ' + (err ? err.message : ''));
					if(!err) {
						swarmIds[uid] = 0;
					}
					callback(err);
				});
			}
		});

	},
	sendSwarms: function () {
		for (let i = 0; i < NUMBER_OF_SWARMS; ++i) {
			setTimeout(() => {
				this.__sendSwarm((err) => {
					if (!err) {
						sentSwarms++;
					}
				});
			}, i);
		}
	},
	__getSwarm: function (callback) {
		$$.remote.doHttpGet(url, (err, data) => {
			assert.false(err, 'Getting swarm has failed');
			callback(err, data);
		});
	},
	getSwarms: function () {
		for (let i = 0; i < NUMBER_OF_SWARMS; ++i) {
			setTimeout(() => {
				this.__getSwarm((err, data) => {
					if (!err) {
						const swarm = JSON.parse(data);
						const swarmId = swarm.meta.swarmId;
						swarmIds[swarmId] = swarmIds[swarmId] ? swarmIds[swarmId] + 1 : 1;
						receivedSwarms++;
					}
				});
			}, i)
		}
	},
	checkResults: function () {
		this.virtualMq.close();

		fileStateManager.restoreState();

		const swarmIdsArr = Object.keys(swarmIds);

		let numberConsumed = 0;
		for (let i = 0; i < swarmIdsArr.length; ++i) {
			if(swarmIds[swarmIdsArr[i]] > 0) {
				numberConsumed++;
			}
		}

		// assert.true(numberConsumed === NUMBER_OF_SWARMS, 'Some swarms were received multiple times');

		assert.true(sentSwarms === NUMBER_OF_SWARMS, `Some swarms were not sent successfully (sent ${sentSwarms} of ${NUMBER_OF_SWARMS})`);
		assert.true(receivedSwarms === NUMBER_OF_SWARMS, `Some swarms were not consumed (received ${receivedSwarms} of ${NUMBER_OF_SWARMS})`);

		this.cb();
	}
})();

assert.callback("simultaneousReadWrite", function (callback) {
	flow.init(callback);
}, 8000);

const swarmDefinition = {
	meta: {
		swarmId: undefined,
		requestId: undefined,
		swarmTypeName: 'testSwarm',
		phaseName: 'testPhase',
		args: undefined,
		command: 'relay',
		target: 'agent\\agent_x'
	}
};

