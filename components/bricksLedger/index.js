
function bricksLedger(server) {
	const { URL_PREFIX } = require('./constants');
	const { responseModifierMiddleware, requestBodyJSONMiddleware } = require('../../utils/middlewares');
	const worldStateManager = require('./worldStateManager');
	const brickFabricStorage = require('./brickFabricStorage');
	const parentAnchoring = require('./parentAnchoring');
	
	server.use(`${URL_PREFIX}/*`, responseModifierMiddleware);
	server.use(`${URL_PREFIX}/*`, requestBodyJSONMiddleware);
	server.get(`${URL_PREFIX}`, (req, res) => {

		server.get('/testion', (req, res) => {
			res.send(200, 'nestings')
		});
	});

	worldStateManager(server);
	brickFabricStorage(server);
	parentAnchoring(server);
}

module.exports = bricksLedger;
