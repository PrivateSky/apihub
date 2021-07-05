function LocalMQAdapter(server, prefix, domain, configuration) {
	const subscribers = {};

	const utils = require('./../../../utils');
	const swarmUtils = require('swarmutils');
	let path = swarmUtils.path;
	const readBody = utils.streams.readStringFromStream;
	const serverConfig = require("./../../../config");

	const settings = {
		mq_fsStrategyStorageFolder: path.join(path.resolve(serverConfig.getConfig("storage")), "mqs", domain),
		mq_fsMessageMaxSize: 1024,
		mq_fsQueueLength: 100
	}

	Object.assign(settings, configuration);

	function getQueueStoragePath(queueName) {
		const opendsu = require("opendsu");
		const crypto = opendsu.loadAPI('crypto');
		if (queueName.indexOf(':') !== -1) {
			queueName = crypto.encodeBase58(queueName);
		}
		return path.join(settings.mq_fsStrategyStorageFolder, queueName);
	}

	function checkQueueLoad(queueName, callback) {
		loadQueue(queueName, (err, files) => {
			if (err) {
				return callback(err);
			}
			callback(undefined, files.length);
		});
	}

	function loadQueue(queueName, callback) {
		require('fs').readdir(getQueueStoragePath(queueName), (err, files) => {
			if (err) {
				if(err.code !== "ENOENT"){
					return callback(err);
				}
				//storage folder for the queue doesn't exist => empty queue
				return callback(undefined, []);
			}
			let messages = files.filter(fileNamesAsTimestamp => {
				let valid = (new Date(Number(fileNamesAsTimestamp))).getTime() > 0;
				if (!valid) {
					console.log(`Found garbage in queue ${queueName} (file: ${fileNamesAsTimestamp}). Ignoring it!`);
				}
				return valid;
			});

			messages.sort(function (a, b) {
				return (new Date(Number(a))).getTime() - (new Date(Number(b))).getTime();
			});

			return callback(undefined, messages);
		});
	}

	function storeMessage(queueName, message, callback) {
		const queueDir = getQueueStoragePath(queueName);
		require('fs').mkdir(queueDir, {recursive: true}, (err)=>{
			if (err) {
				return callback(err);
			}

			let fileName = path.join(getQueueStoragePath(queueName), new Date().getTime());
			require('fs').writeFile(fileName, message, (err) => {
				if (err) {
					return callback(err);
				}
				return callback(undefined, fileName);
			});
		});
	}

	function getMessagePath(queueName, messageId) {
		return path.join(getQueueStoragePath(queueName), messageId);
	}

	function getMessage(queueName, messageId, callback) {
		let fileName = getMessagePath(queueName, messageId);
		require('fs').readFile(fileName, (err, message) => {
			if (err) {
				return callback(err);
			}
			return callback(undefined, {message:message.toString(), messageId});
		});
	}

	function deleteMessage(queueName, messageId, callback) {
		let fileName = getMessagePath(queueName, messageId);
		require('fs').unlink(fileName, callback);
	}

	function _readMessage(queueName, messageId, callback) {
		if (typeof messageId === "function") {
			callback = messageId;
			messageId = undefined;
		}
		loadQueue(queueName, (err, messageIds) => {
			if (err) {
				return callback(err);
			}

			if (typeof messageId !== "undefined") {
				if (messageIds.indexOf(messageId) !== -1) {
					return callback(Error("Message not found."));
				}
			} else {
				messageId = messageIds[messageIds.length-1];
			}
			return getMessage(queueName, messageId, callback);
		});
	}

	function deliverMessage(subs, message, callback) {
		let counter = 0;
		while (subs.length > 0) {
			let sub = subs.pop();
			try {
				sub(undefined, message);
				counter++;
			} catch (err) {
				//if something happens during message delivery we will catch the error here
			}
		}
		callback(undefined, counter);
	}

	function putMessage(queueName, message, callback) {
		checkQueueLoad(queueName, (err, capacity) => {
			if (err) {
				return callback(err);
			}

			if (typeof subscribers[queueName] === 'undefined') {
				subscribers[queueName] = [];
			}

			const capacityLimit = Number(settings.mq_fsQueueLength);

			if(capacity > capacityLimit){
				const err = new Error("Queue size exceeded!");
				err.sendToUser = true;
				return callback(err);
			}

			if (capacity > 0) {
				return storeMessage(queueName, message, callback);
			}

			//if queue is empty we should try to deliver the message to a potential subscriber that waits
			const subs = subscribers[queueName];
			storeMessage(queueName, message, (err)=>{
				if (err) {
					return callback(err);
				}
				return _readMessage(queueName, (err, _message) => {
					if (err) {
						return callback(err);
					}
					deliverMessage(subs, _message, callback);
				});
			})
		});
	}

	function readMessage(queueName, sub) {
		checkQueueLoad(queueName, (err, capacity) => {
			if (err) {
				return sub(err);
			}

			if (typeof subscribers[queueName] === 'undefined') {
				subscribers[queueName] = [];
			}

			const subs = subscribers[queueName];
			subs.push(sub);

			if (capacity) {
				return _readMessage(queueName, (err, message) => {
					deliverMessage(subs, message, (err, successCount) => {
						if (err) {
							console.log(err);
						}

						console.log(`Successfully sent message to a number of ${successCount} subs.`);
					});
				});
			} else {
				//no message available in queue
			}
		});
	}

	function send(to, statusCode, message, headers) {
		to.statusCode = statusCode;

		if (headers) {
			for (let prop in headers) {
				to.setHeader(prop, headers[prop]);
			}
		}

		if (message) {
			to.write(message);
		}
		to.end();
	}

	function putMessageHandler(request, response) {
		let queueName = request.params.queueName;
		readBody(request, (err, message) => {
			if (err) {
				console.log(`Caught an error during body reading from put message request`, err);
				return send(response, 500);
			}

			if(typeof settings.mq_fsMessageMaxSize !== "undefined"){
				const messageMaxSize = Number(settings.mq_fsMessageMaxSize);
				try{
					let messageAsBuffer = Buffer.from(message);
					if(messageAsBuffer.length > messageMaxSize){
						send(response, 403, "Message size exceeds domain specific limit.");
						return;
					}
				}catch(err){
					console.log("Not able to confirm message size. Going on with the flow...");
				}
			}

			putMessage(queueName, message, (err) => {
				if (err) {
					console.log(`Caught an error during adding message to queue`, err);
					return send(response, 500, err.sendToUser ? err.message : undefined);
				}
				send(response, 200);
			});
		});
	}

	function getMessageHandler(request, response) {
		readMessage(request.params.queueName, (err, message) => {
			if (err) {
				send(response, 500);
				return;
			}
			send(response, 200, JSON.stringify(message), {'Content-Type': 'application/json'});
			return;
		});
	}

	function deleteMessageHandler(request, response) {
		let {queueName, messageId} = request.params;
		deleteMessage(queueName, messageId, (err) => {
			if (err) {
				console.log(`Caught an error during deleting message ${messageId} from queue ${queueName}`, err);
			}
			send(response, err ? 500 : 200);
		});
	}

	function takeMessageHandler(request, response) {
		const queueName = request.params.queueName;
		readMessage(queueName, (err, message) => {
			if (err) {
				console.log(`Caught an error during message reading from ${queueName}`, err);
				send(response, 500);
				return;
			}
			deleteMessage(queueName, message.messageId, (err) => {
				if (err) {
					console.log(`Caught an error during message deletion from ${queueName} on the take handler`, err);
					return send(response, 500);
				}

				return send(response, 200, JSON.stringify(message), {'Content-Type': 'application/json'});
			});
		});
	}

	console.log(`Loading Local MQ Adapter for domain: ${domain}`);
	console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`);
	console.log(`Warning: Local MQ Adapter should be used only during development!`);
	console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`);

	server.put(`${prefix}/${domain}/put/:queueName`, putMessageHandler); //< message

	server.get(`${prefix}/${domain}/get/:queueName/:signature_of_did`, getMessageHandler); //  > {message}
	server.delete(`${prefix}/${domain}/delete/:queueName/:messageId/:signature_of_did`, deleteMessageHandler);

	server.get(`${prefix}/${domain}/take/:queueName/:signature_of_did`, takeMessageHandler); //  > message
}


module.exports = LocalMQAdapter;