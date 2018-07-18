require("../../../engine/core");
const path = require("path");
const fs = require("fs");
const folderMQ = $$.requireModule("soundpubsub").folderMQ;

let rootfolder;
const channels = {

};

function storeChannel(id, channel, consumer){
	var storedChannel = {
		channel: channel,
		handler: channel.getHandler(),
		consumers:[]
	};

	if(!channels[id]){
		channels[id] = storedChannel;
	}

	if(consumer){
		channels[id].consumers.push(consumer);
	}
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
	startSwarm: function(channelId, readSwarmStream, callback){
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
				 channels[channelId].handler.addStream(readSwarmStream, callback);
			});
			storeChannel(channelId, channel);
		}else{
			channel.handler.addStream(readSwarmStream, callback);
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
				channel.registerConsumer(callback);
			});
			storeChannel(channelId, channel, callback);

		}else{
			channel.channel.registerConsumer(callback);
		}
	}
});