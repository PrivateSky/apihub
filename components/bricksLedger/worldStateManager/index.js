// Browserify
require('../../../commands.mock2.js');

function WorldStateManagerStrategy(server) {
	const { responseModifierMiddleware, requestBodyJSONMiddleware } = require('../../../utils/middlewares');
    const commandDispatcher = require('./controllers');

	server.put('/bricks-ledger/wsms/command', responseModifierMiddleware);
	server.put('/bricks-ledger/wsms/command', requestBodyJSONMiddleware);
	server.put('/bricks-ledger/wsms/command', commandDispatcher);
}



module.exports = WorldStateManagerStrategy;
