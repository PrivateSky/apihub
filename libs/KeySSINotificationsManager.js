function KeySSINotificationsManager(server) {

	let notificationManager;
	const utils = require("./../utils");
	const readBody = utils.streams.readStringFromStream;
	const serverConfigUtils = utils.serverConfig;
	const workingDirPath = serverConfigUtils.getConfig('endpointsConfig', 'messaging', 'workingDirPath');

	function sendStatus(res, reasonCode) {
		res.statusCode = reasonCode;
		res.end();
	}

	function publish(req, res) {
		let anchorId = req.params.anchorId;

		readBody(req, (err, message) => {
			if (err) {
				return sendStatus(res, 400);
			}

			notificationManager.createQueue(anchorId, function (err) {
				if (err) {
					if (err.statusCode) {
						if (err.statusCode !== 409) {
							return sendStatus(res, err.statusCode);
						}
					} else {
						return sendStatus(res, 500);
					}
				}

				notificationManager.sendMessage(anchorId, message, function (err, counter) {
					if (err) {
						return sendStatus(res, 500);
					}

					if (counter > 0) {
						res.write(`Message delivered to ${counter} subscribers.`);
					} else {
						res.write(`Message was added to queue and will be delivered later.`);
					}

					return sendStatus(res, 200);
				});
			});
		});
	}

	function subscribe(req, res) {
		let anchorId = req.params.anchorId;

		notificationManager.createQueue(anchorId, function (err) {
			if (err) {
				if (err.statusCode) {
					if (err.statusCode !== 409) {
						return sendStatus(res, err.statusCode);
					}
				} else {
					return sendStatus(res, 500);
				}
			}

			notificationManager.readMessage(anchorId, function (err, message) {
				try {
					if (err) {
						if (err.statusCode) {
							return sendStatus(res, err.statusCode);
						} else {
							return sendStatus(res, 500);
						}
					}
					res.write(message);
					sendStatus(res, 200);
				} catch (err) {
					//here we expect to get errors when a connection has reached timeout
					console.log(err);
				}
			});
		});
	}

	function unsubscribe(req, res) {
		//to be implemented later
		sendStatus(res, 503);
	}

	require("./Notifications").getManagerInstance(workingDirPath, function (err, instance) {
		if (err) {
			return console.log(err);
		}

		notificationManager = instance;

		server.post("/notifications/subscribe/:anchorId", subscribe);
		server.post("/notifications/unsubscribe/:anchorId", unsubscribe);
		server.get("/notifications/publish/:anchorId", publish);
	});
}

module.exports = KeySSINotificationsManager;