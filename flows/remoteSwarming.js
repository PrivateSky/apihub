const path = require("path");
const fs = require("fs");
const folderMQ = require("foldermq");

let rootfolder;
const channels = {};

function storeChannel(id, channel, clientConsumer){
	var storedChannel = {
		channel: channel,
		handler: channel.getHandler(),
		mqConsumer: null,
		consumers:[]
	};

	if(!channels[id]){
		channels[id] = storedChannel;
	}

	if(clientConsumer){
		storedChannel = channels[id];
		channels[id].consumers.push(clientConsumer);
	}

	return storedChannel;
}


function registerConsumer(id, consumer){
	const storedChannel = channels[id];
	if(storedChannel){
		storedChannel.consumers.push(consumer);
		return true;
	}
	return false;
}

function deliverToConsumers(consumers, err, result, confirmationId){
	if(!consumers){
		return false;
	}
    let deliveredMessages = 0;
    while(consumers.length>0){
        //we iterate through the consumers list in case that we have a ref. of a request that time-outed meanwhile
        //and in this case we expect to have more then one consumer...
        const consumer = consumers.pop();
        try{
            consumer(err, result, confirmationId);
            deliveredMessages++;
        }catch(error){
            //just some small error ignored
            console.log("Error catched", error);
        }
    }
    return !!deliveredMessages;
}

function registerMainConsumer(id){
	const storedChannel = channels[id];
	if(storedChannel && !storedChannel.mqConsumer){
		storedChannel.mqConsumer = (err, result, confirmationId) => {
			channels[id] = null;
			deliverToConsumers(storedChannel.consumers, err, result, confirmationId);
			/*while(storedChannel.consumers.length>0){
				//we iterate through the consumers list in case that we have a ref. of a request that time-outed meanwhile
				//and in this case we expect to have more then one consumer...
				let consumer = storedChannel.consumers.pop();
				try{
					consumer(err, result, confirmationId);
				}catch(error){
					//just some small error ignored
					console.log("Error catched", error);
				}
			}*/
		};

		storedChannel.channel.registerConsumer(storedChannel.mqConsumer, false, () => !!channels[id]);
		return true;
	}
	return false;
}

function readSwarmFromStream(stream, callback){
    let swarm = "";
    stream.on('data', (chunk) =>{
        swarm += chunk;
	});

    stream.on("end", () => {
       callback(null, swarm);
	});

    stream.on("error", (err) =>{
        callback(err);
	});
}

$$.flow.describe("RemoteSwarming", {
	init: function(rootFolder, callback){
		if(!rootFolder){
			callback(new Error("No root folder specified!"));
			return;
		}
		rootFolder = path.resolve(rootFolder);
		$$.ensureFolderExists(rootFolder, function(err, path){
			rootfolder = rootFolder;

			if(!err){
				fs.readdir(rootfolder, (cleanErr, files) => {
					while(files && files.length > 0){
						console.log("Root folder found to have some dirs. Start cleaning empty dirs.");
						let dir = files.pop();
						try{
							const path = require("path");
							dir = path.join(rootFolder, dir);
							var content = fs.readdirSync(dir);
							if(content && content.length === 0){
								console.log("Removing empty dir", dir);
								fs.rmdirSync(dir);
							}
						}catch(err){
							//console.log(err);
						}
					}
					callback(cleanErr, rootFolder);
				});
			}else{
				return callback(err, rootFolder);
			}
		});
	},
	startSwarm: function (channelId, swarmSerialization, callback) {
		let channel = channels[channelId];
		if (!channel) {
			const channelFolder = path.join(rootfolder, channelId);
			let storedChannel;
			channel = folderMQ.createQue(channelFolder, (err, result) => {
				if (err) {
					//we delete the channel in order to try again next time
					channels[channelId] = null;
					callback(new Error("Channel initialization failed"));
					return;
				}

				let sent = false;
				try {
					sent = deliverToConsumers(channel.consumers, null, JSON.parse(swarmSerialization));
				} catch (err) {
					console.log(err);
				}

				if (!sent) {
					storedChannel.handler.sendSwarmSerialization(swarmSerialization, callback);
				} else {
					return callback(null, swarmSerialization);
				}

			});
			storedChannel = storeChannel(channelId, channel);
		} else {

			let sent = false;
			try {
				sent = deliverToConsumers(channel.consumers, null, JSON.parse(swarmSerialization));
			} catch (err) {
				console.log(err);
			}

			if (!sent) {
				channel.handler.sendSwarmSerialization(swarmSerialization, callback);
			} else {
				return callback(null, swarmSerialization);
			}
		}
	},
	confirmSwarm: function(channelId, confirmationId, callback){
		if(!confirmationId){
			callback();
			return;
		}
		const storedChannel = channels[channelId];
		if(!storedChannel){
			const channelFolder = path.join(rootfolder, channelId);
			const channel = folderMQ.createQue(channelFolder, (err, result) => {
				if(err){
					//we delete the channel in order to try again next time
					channels[channelId] = null;
					callback(new Error("Channel initialization failed"));
					return;
				}
				channel.unlinkContent(confirmationId, callback);
			});
		}else{
			storedChannel.channel.unlinkContent(confirmationId, callback);
		}
	},
	waitForSwarm: function(channelId, writeSwarmStream, callback){
		let channel = channels[channelId];
		if(!channel){
			const channelFolder = path.join(rootfolder, channelId);
			channel = folderMQ.createQue(channelFolder, (err, result) => {
				if(err){
					//we delete the channel in order to try again next time
					channels[channelId] = null;
					callback(new Error("Channel initialization failed"), {});
					return;
				}
				if(!registerConsumer(channelId, callback)){
					callback(new Error("Registering consumer failed!"), {});
				}
				registerMainConsumer(channelId);
			});
			storeChannel(channelId, channel);
		}else{
			//channel.channel.registerConsumer(callback);
            if(!registerConsumer(channelId, callback)){
                callback(new Error("Registering consumer failed!"), {});
            }
            registerMainConsumer(channelId);
		}
	}
});
