require("../../../engine/core");
const path = require("path");
const fs = require("fs");
const folderMQ = $$.requireModule("soundpubsub").folderMQ;

let rootfolder;
const channels = {

};

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
					callback(new Error("Channel initialization failed"));
					return;
				}

				channel.getHandler().addStream(readSwarmStream, callback);
			});
			channels[channelId] = channel;
		}else{
			channel.getHandler().addStream(readSwarmStream, callback);
		}
	},
	waitForSwarm: function(channelId, writeSwarmStream, callback){
		let channel = channels[channelId];
		if(!channel){
			let channelFolder = path.join(rootfolder, channelId);
			channel = folderMQ.getFolderQueue(channelFolder, (err, result) => {
				if(err){
					callback(new Error("Channel initialization failed"));
					return;
				}

				channel.getHandler().registerConsumer(callback);
			});
			channels[channelId] = channel;
		}else{
			channel.getHandler().addStream(readSwarmStream, callback);
		}
	}
});