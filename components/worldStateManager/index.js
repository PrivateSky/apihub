// Browserify
require('../../commands.mock2.js');

function WorldStateManagerStrategy(server) {
	const { responseModifierMiddleware, requestBodyJSONMiddleware } = require('../../utils/middlewares');
    const commandDispatcher = require('./controllers');
	console.log(commandDispatcher)
	server.put('/command/:commandType', responseModifierMiddleware);
	server.put('/command/:commandType', requestBodyJSONMiddleware);
	server.put('/command/:commandType', commandDispatcher);
}



module.exports = WorldStateManagerStrategy;
