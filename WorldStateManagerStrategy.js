// Browserify
require('./commands.mock2.js');

function WorldStateManagerStrategy(server) {
	const { serverConfig: serverConfigUtils } = require('./utils');
	const { makeRequest } = require('./utils').requests;
	const { responseModifierMiddleware, requestBodyJSONMiddleware } = require('./utils/middlewares');
	const BrickFabricStorage = require('./BrickFabricStorage')

	async function commandDispatcher(request, response, next) {
		const command = serverConfigUtils.getConfig('endpointsConfig', 'worldStateManagerStrategy', 'commands', request.params.commandType);

		if (invalidCommand(command)) {
			return response.send(400, 'Bad request. Invalid config', () => response.end());
		}

		let commandResponse;

		if (command.url) {
			commandResponse = await makeRequest(command.url, 'POST', request.body).catch((err) => {
				return response.send(err.statusCode || 400, err.body || 'Bad request', () => response.end())
			});
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

		return BrickFabricStorage(request.params.commandType, request.body, next);
	}

	server.put('/command/:commandType', responseModifierMiddleware);
	server.put('/command/:commandType', requestBodyJSONMiddleware);
	server.put('/command/:commandType', commandDispatcher);
}

function invalidCommand(command) {
	const regex = /^(?:http(s)?:\/\/)((:[\d]+)?)[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+$/gm;

	return !command || !Object.keys(command).length || (command.url && !regex.test(command.url))
}

module.exports = WorldStateManagerStrategy;
