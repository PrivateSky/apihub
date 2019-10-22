require("../../../../psknode/bundles/pskruntime");
require("../../../../psknode/bundles/virtualMQ");
require("../../../../psknode/bundles/psknode");

const assert           = require("double-check").assert;
const fileStateManager = require('../../../../libraries/utils/FileStateManager').getFileStateManager();
const VirtualMQ = require('../../index');
const path             = require('path');
const childProcess     = require('child_process');
require('psk-http-client');

const PORT = 9090;
const tempFolder = path.resolve('../../../tmp');
const CHANNEL_NAME = 'testChannel';
const url = `http://127.0.0.1:${PORT}/${CHANNEL_NAME}`;
const NUMBER_OF_SWARMS = 30;

let receivedSwarms = 0;
let sentSwarms = 0;

const swarmIds = {};

let childProcessInstance;

const flow = $$.flow.describe('simultaneousReadWrite', {
	init: function (callback) {
		this.cb = callback;

		this.sendSwarms();
		this.getSwarms(0, () => {
			this.checkResults();
		});
	},
	__sendSwarm: function (callback) {
		$$.uidGenerator.safe_uuid(function (err, uid) {
			if (!err) {
				const swarm = JSON.parse(JSON.stringify(swarmDefinition));
				swarm.meta.swarmId = uid;
				swarm.meta.requestId = uid;

				$$.remote.doHttpPost(url, JSON.stringify(swarm), (err, data) => {
					assert.false(err, 'Posting swarm failed ' + (err ? err.message : ''));
					if (!err) {
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
			}, i * 3);
		}
	},
	__getSwarm: function (callback) {
		$$.remote.doHttpGet(url, (err, data) => {
			assert.false(err, 'Getting swarm has failed');
			callback(err, data);
		});
	},
	getSwarms: function (index, callback) {
		if (index < NUMBER_OF_SWARMS) {
			setTimeout(() => {
				this.__getSwarm((err, data) => {
					if (!err) {
						const swarm = JSON.parse(data);
						const swarmId = swarm.meta.swarmId;
						swarmIds[swarmId] = swarmIds[swarmId] ? swarmIds[swarmId] + 1 : 1;
						receivedSwarms++;
					}
					this.getSwarms(++index, callback);
				});
			}, 0);
		} else {
			callback();
		}
	},
	checkResults: function () {
		childProcessInstance.kill();
		fileStateManager.restoreState();


		const swarmIdsArr = Object.keys(swarmIds);

		let numberConsumed = 0;
		let numberNotConsumed = 0;
		for (let i = 0; i < swarmIdsArr.length; ++i) {
			if (swarmIds[swarmIdsArr[i]] > 0) {
				numberConsumed++;
			} else if (swarmIds[swarmIdsArr[i]] === 0) {
				numberNotConsumed++;
			}
		}

		assert.true(sentSwarms === NUMBER_OF_SWARMS, `Some swarms were not sent successfully (sent ${sentSwarms} of ${NUMBER_OF_SWARMS})`);
		assert.true(numberNotConsumed === 0, `Some swarms were not consumed (${numberNotConsumed} of ${NUMBER_OF_SWARMS})`);
		assert.true(receivedSwarms === NUMBER_OF_SWARMS, `Some swarms were not received (received ${receivedSwarms} of ${NUMBER_OF_SWARMS})`);
		assert.true(numberConsumed === NUMBER_OF_SWARMS, 'Some swarms were received multiple times');

		this.cb();
	}
})();


if (process.argv[2] === '--child') {
	VirtualMQ.createVirtualMQ(PORT, tempFolder, () => {});
} else {
	fileStateManager.saveState([tempFolder], (err) => {
		assert.false(err, 'Saving state has failed');
		childProcessInstance = childProcess.fork(process.argv[1], ['--child']);
		setTimeout(() => {
			assert.callback("simultaneousReadWrite", function (callback) {
				flow.init(callback);
			}, 15000);
		}, 2000);
	});
}

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

