function KeySSINotifications(server) {
	let notificationManager;
	const utils = require('../../utils');
	const readBody = utils.streams.readStringFromStream;
	const serverConfigUtils = utils.serverConfig;
	const { responseModifierMiddleware } = require('./../../utils/middlewares');
	const { URL_PREFIX } = require('./constants');
	const workingDirPath = serverConfigUtils.getConfig('endpointsConfig', 'messaging', 'workingDirPath');

	function publish(request, response, next) {
		let anchorId = request.params.anchorId;

		readBody(req, (err, message) => {
			if (err) {
				return response.send(400);
			}

			notificationManager.createQueue(anchorId, function (err) {
				if (err) {
					if (err.statusCode) {
						if (err.statusCode !== 409) {
							return response.send(err.statusCode, null, next);
						}
					} else {
						return response.send(500, null, next);
					}
				}

				notificationManager.sendMessage(anchorId, message, function (err, counter) {
					if (err) {
						return response.send(500, null, next);
					}

					let message;

					if (counter > 0) {
						message = `Message delivered to ${counter} subscribers.`;
					} else {
						message = `Message was added to queue and will be delivered later.`;
					}

					return response.send(200, body, next);
				});
			});
		});
	}

	function subscribe(request, response, next) {
		let anchorId = request.params.anchorId;

		notificationManager.createQueue(anchorId, function (err) {
			if (err) {
				if (err.statusCode) {
					if (err.statusCode !== 409) {
						return response.send(err.statusCode, null, next);
					}
				} else {
					return response.send(500, null, next);
				}
			}

			notificationManager.readMessage(anchorId, function (err, message) {
				try {
					if (err) {
						return response.send(err.statusCode || 500, message || null, next);
					}

					response.send(200, message, next);
				} catch (err) {
					//here we expect to get errors when a connection has reached timeout
					console.log(err);
					response.send(400, 'opps');
				}
			});
		});
	}

	function unsubscribe(request, response) {
		//to be implemented later
		response.send(503);
	}

	require('./../../libs/Notifications').getManagerInstance(workingDirPath, (err, instance) => {
		if (err) {
			return console.log(err);
		}

		notificationManager = instance;
		server.use(`${URL_PREFIX}/*`, responseModifierMiddleware)

		server.post(`${URL_PREFIX}/subscribe/:anchorId`, subscribe);
		server.delete(`${URL_PREFIX}/unsubscribe/:anchorId`, unsubscribe);
		server.put(`${URL_PREFIX}/publish/:anchorId`, publish);
	});
}

module.exports = KeySSINotifications;
