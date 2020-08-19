
function bricksLedger(server) {
	const worldStateManager = require('./worldStateManager');
	const brickFabricStorage = require('./brickFabricStorage');

	worldStateManager(server);
	brickFabricStorage(server);
}

module.exports = bricksLedger;
