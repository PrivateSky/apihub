// Browserify
require('./commands.mock2.js');

function WorldStateManagerStrategy(server) {
	const { serverConfig: serverConfigUtils, makeRequest } = require('./utils');
	const { responseModifierMiddleware, requestBodyJSONMiddleware } = require('./utils/middlewares');


	async function commandDispatcher(request, response, next) {
		const command = serverConfigUtils.getConfig('endpointsConfig', 'worldStateManagerStrategy', 'commands', request.params.commandType);

		if (invalidCommand(command)) {
			return response.send(400, 'Bad request. Invalid config', () => response.end());
		}

		let commandResponse;

		if (command.url) {
			const URL = new URL(command.url);
			const options = {
				hostname: URL.host,
				path: URL.pathname,
				method: 'POST'
			};

			commandResponse = await makeRequest(options, request.body);
		} else if (command.module) {
			let module;

			try {
				module = require(command.module);
			} catch (err) {
				return response.send(400, 'Module not found', () => response.end());
			}

			commandResponse = {
				statusCode: 200,
				body: command.function ? module[command.function]() : module()
			};
		}

		response.send(commandResponse.statusCode, commandResponse.body);

		return commandToBrick(request.params.commandType, request.body, commandResponse, next);
	}

	server.put('/command/:commandType', responseModifierMiddleware);
	server.put('/command/:commandType', requestBodyJSONMiddleware);
	server.put('/command/:commandType', commandDispatcher);
}

function commandToBrick(commandType, requestBody, commandResponse, callback) {
	console.log('====');
	console.log(commandType, requestBody, commandResponse);
	callback();

	// command json is the body of the request
	// bfs => {get n commands and PUT a brick}
	// if genesis generate an initial brick -> all bricks refer to the previous bricks (store previous brick reference)
	// brick storage/ get -> if valid ok (previous) if not genesis

	// fs.appendFile('temp-brickstorage.json', JSON.stringify({commandType, requestBody, commandResponse}), function (err) {
	// 	if (err) {
	// 		return callback();
	// 	};
	// 	callback();
	// });

}

function invalidCommand(command) {
	const regex = /^(?:http(s)?:\/\/)((:[\d]+)?)[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+$/gm;

	return !command || !Object.keys(command).length || (command.url && !regex.test(command.url))
}

module.exports = WorldStateManagerStrategy;
