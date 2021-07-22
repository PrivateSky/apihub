function mqManager(server) {
	let notificationManager;
	const utils = require('./../../utils');
	const { URL_PREFIX } = require('./constants');
	const readBody = utils.streams.readStringFromStream;
	const config = require('../../config');
	const path = require("path");
	const workingDirPath = path.join(server.rootFolder, config.getConfig('componentsConfig', 'messaging', 'workingDirPath'));
	const storageDirPath = path.join(server.rootFolder, config.getConfig('componentsConfig', 'messaging', 'storageDirPath'));

	function sendStatus(res, reasonCode) {
		res.statusCode = reasonCode;
		res.end();
	}

	function createChannel(req, res) {
		let anchorId = req.params.anchorId;
		let SSI = req.headers['ssi'];
		if (/*typeof SSI === 'undefined' ||*/ typeof anchorId === 'undefined') {
			return sendStatus(res, 400);
		}

		notificationManager.createQueue(anchorId, function (err) {
			if (err) {
				if (err.statusCode) {
					res.write(err.message);
					return sendStatus(res, err.statusCode);
				} else {
					return sendStatus(res, 500);
				}
			}

			//store SSI to check ownership

			sendStatus(res, 200);
		});
	}

	function sendMessage(req, res) {
		let anchorId = req.params.anchorId;
		if (typeof anchorId === 'undefined') {
			return sendStatus(res, 400);
		}
		readBody(req, (err, message) => {
			if (err) {
				return sendStatus(res, 400);
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
	}

	function receiveMessage(req, res) {
		let anchorId = req.params.anchorId;
		if (typeof anchorId === 'undefined') {
			return sendStatus(res, 400);
		}

		//check tokens before delivering a message

		let connectionActive = true;
		req.connection.on('close', function(err) {
			//console.log("Connection closed (timeout or client closed conection)");
			connectionActive = false;
		});

		notificationManager.readMessage(anchorId, function (err, message) {
			if (err) {
				if (err.statusCode) {
					return sendStatus(res, err.statusCode);
				} else {
					return sendStatus(res, 500);
				}
			}
			if(!connectionActive){
				throw new Error("Connection not active with this subscriber.");
			}
			res.write(message);
			sendStatus(res, 200);
		});
	}

	require('./../../libs/Notifications').getManagerInstance(workingDirPath, storageDirPath, (err, instance) => {
		if (err) {
			return console.log(err);
		}

		notificationManager = instance;

		// Proposed
		// server.get(`${URL_PREFIX}/channel/:anchorId/message`, createChannel);

		server.post(`${URL_PREFIX}/create-channel/:anchorId`, createChannel);
		server.post(`${URL_PREFIX}/send-message/:anchorId`, sendMessage);
		server.get(`${URL_PREFIX}/receive-message/:anchorId`, receiveMessage);
	});
}

module.exports = mqManager;
