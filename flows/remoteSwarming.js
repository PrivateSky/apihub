require("../../../engine/core");
const path = require("path");
const fs = require("fs");
const folderMQ = $$.requireModule("soundpubsub").folderMQ;

let rootfolder;
const channels = {

};

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
		channels[id].consumers.push(clientConsumer);
	}

	return storedChannel;
}


function registerConsumer(id, consumer){
	let storedChannel = channels[id];
	if(storedChannel){
		storedChannel.consumers.push(consumer);
		return true;
	}
	return false;
}

function registerMainConsumer(id){
	let storedChannel = channels[id];
	if(storedChannel && !storedChannel.mqConsumer){
		storedChannel.mqConsumer = (err, result, confirmationId) => {
			channels[id] = null;
			while(storedChannel.consumers.length>0){
				//we iterate through the consumers list in case that we have a ref. of a request that time-outed meanwhile
				//and in this case we expect to have more then one consumer...
				let consumer = storedChannel.consumers.pop();
				try{
					consumer(err, result, confirmationId);
				}catch(error){
					//just some small error ignored
					console.log("Error catched", error);
				}
			}
		};

		storedChannel.channel.registerConsumer(storedChannel.mqConsumer, false, () => {
			return !!channels[id];
		});
		return true;
	}
	return false;
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
			callback(err, rootFolder);
		});
	},
	startSwarm: function (channelId, readSwarmStream, callback) {
		let channel = channels[channelId];
		if (!channel) {
			let channelFolder = path.join(rootfolder, channelId);
			let storedChannel;
			channel = folderMQ.getFolderQueue(channelFolder, (err, result) => {
				if (err) {
					//we delete the channel in order to try again next time
					channels[channelId] = null;
					callback(new Error("Channel initialization failed"));
					return;
				}

				storedChannel.handler.addStream(readSwarmStream, callback);
				
			});
			storedChannel = storeChannel(channelId, channel);
		} else {
			channel.handler.addStream(readSwarmStream, callback);
		}
	},
	confirmSwarm: function(channelId, confirmationId, callback){
		let storedChannel = channels[channelId];
		if(!storedChannel){
			let channelFolder = path.join(rootfolder, channelId);
			let channel = folderMQ.getFolderQueue(channelFolder, (err, result) => {
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
			let channelFolder = path.join(rootfolder, channelId);
			channel = folderMQ.getFolderQueue(channelFolder, (err, result) => {
				if(err){
					//we delete the channel in order to try again next time
					channels[channelId] = null;
					callback(new Error("Channel initialization failed"));
					return;
				}
				registerConsumer(channelId, callback);
				registerMainConsumer(channelId);
			});
			storeChannel(channelId, channel);
		}else{
			//channel.channel.registerConsumer(callback);
			registerConsumer(channelId, callback);
			registerMainConsumer(channelId);
		}
	}
});
