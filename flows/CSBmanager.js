require("../../../engine/core");
const path = require("path");
const fs = require("fs");

const folderNameSize = process.env.FOLDER_NAME_SIZE || 5;
var rootfolder;


$$.flow.describe("CSBmanager", {
	init: function(rootFolder, callback){
		if(!rootFolder){
			callback(new Error("No root folder specified!"));
			return;
		}
		rootFolder = path.resolve(rootFolder);
		this.__ensureFolderStructure(rootFolder, function(err, path){
			rootfolder = rootFolder;
			callback(err, rootFolder);
		});
	},
	write: function(fileName, readFileStream, callback){
		if(!this.__verifyFileName(fileName, callback)){
			return;
		}

		if(!readFileStream || !readFileStream.pipe || typeof readFileStream.pipe !== "function"){
			callback(new Error("Something wrong happened"));
			return;
		}

		var folderName = path.join(rootfolder, fileName.substr(0, folderNameSize));

		var serialExecution = this.serial(callback);
		serialExecution.__ensureFolderStructure(folderName, serialExecution.__progress);
		serialExecution.__writeFile(readFileStream, path.join(folderName, fileName), serialExecution.__progress);
	},
	read: function(fileName, writeFileStream, callback){
		if(!this.__verifyFileName(fileName, callback)){
			return;
		}

		var folderName = path.join(rootfolder, fileName.substr(0, folderNameSize));
		var filePath = path.join(folderName, fileName);
		this.__verifyFileExistence(filePath, (err, result) => {
			if(!err){
				this.__readFile(writeFileStream, filePath, callback);
			}else{
				callback(new Error("No file found."));
			}
		});
	},
	__verifyFileName: function(fileName, callback){
		if(!fileName || typeof fileName != "string"){
			callback(new Error("No fileId specified."));
			return;
		}

		if(fileName.length < folderNameSize){
			callback(new Error("FileId to small."));
			return;
		}

		return true;
	},
	__ensureFolderStructure: function(folder, callback){
		$$.ensureFolderExists(folder, callback);
	},
	__writeFile: function(readStream, filePath, callback){
		var writeStream = fs.createWriteStream(filePath);

		writeStream.on("finish", callback);
		writeStream.on("error", callback);

		readStream.pipe(writeStream);
	},
	__readFile: function(writeFileStream, filePath, callback){
		var readStream = fs.createReadStream(filePath);

		writeFileStream.on("finish", callback);
		writeFileStream.on("error", callback);

		readStream.pipe(writeFileStream);
	},
	__progress: function(err, result){
		if(err){
			console.error(err);
		}
	},
	__verifyFileExistence: function(filePath, callback){
		fs.stat(filePath, callback);
	}
});