
function bricksLedger(server) {
    const { responseModifierMiddleware, requestBodyJSONMiddleware } = require('../../utils/middlewares');

	const worldStateManager = require('./worldStateManager');
	const brickFabricStorage = require('./brickFabricStorage');
	const parentAnchoring = require('./parentAnchoring');

	server.use('/bricks-ledger/*', responseModifierMiddleware);
    server.use('/bricks-ledger/*', requestBodyJSONMiddleware);

	worldStateManager(server);
	brickFabricStorage(server);
	parentAnchoring(server);
}

module.exports = bricksLedger;
