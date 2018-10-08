require('../../../engine/core');
const path = require("path");
const fs = require("fs");

const folderNameSize = process.env.FOLDER_NAME_SIZE || 5;
let rootfolder;

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

        const folderName = path.join(rootfolder, fileName.substr(0, folderNameSize), fileName);

        const serial = this.serial(() => {});

        serial.__ensureFolderStructure(folderName, serial.__progress);
        serial.__writeFile(readFileStream, folderName, fileName, callback);
    },
    read: function(fileName, writeFileStream, callback){
        if(!this.__verifyFileName(fileName, callback)){
            return;
        }

        const folderPath = path.join(rootfolder, fileName.substr(0, folderNameSize));
        const filePath = path.join(folderPath, fileName);
        this.__verifyFileExistence(filePath, (err, result) => {
            if(!err){
                this.__getLatestVersionNameOfFile(filePath, (err, fileVersion) => {
                    if(err) {
                        return callback(err);
                    }
                    this.__readFile(writeFileStream, path.join(filePath, fileVersion.toString()), callback);
                });
            }else{
                callback(new Error("No file found."));
            }
        });
    },
    readVersion: function(fileName, fileVersion, writeFileStream, callback) {
        if(!this.__verifyFileName(fileName, callback)){
            return;
        }

        const folderPath = path.join(rootfolder, fileName.substr(0, folderNameSize));
        const filePath = path.join(folderPath, fileName, fileVersion);
        this.__verifyFileExistence(filePath, (err, result) => {
            if(!err){
                this.__readFile(writeFileStream, path.join(filePath), callback);
            }else{
                callback(new Error("No file found."));
            }
        });
    },
    getVersionsForFile: function (fileName, callback) {
        if (!this.__verifyFileName(fileName, callback)) {
            return;
        }

        const folderPath = path.join(rootfolder, fileName.substr(0, folderNameSize), fileName);
        fs.readdir(folderPath, (err, files) => {
            if (err) {
                return callback(err);
            }

            const filesInfoPromises = [];

            for (let i = 0; i < files.length; ++i) {
                filesInfoPromises.push(new Promise((resolve, reject) => {
                    fs.stat(path.join(folderPath, files[i]), (err, stats) => {
                        if (err) {
                            return reject(err);
                        }

                        resolve({version: files[i], creationTime: stats.birthtime, creationTimeMs: stats.birthtimeMs});
                    });
                }));
            }

            Promise.all(filesInfoPromises)
                .then((filesInfo => {
                    filesInfo.sort((first, second) => first.version - second.version);
                    callback(undefined, JSON.stringify(filesInfo))
                }))
                .catch(callback);
        });
    },
    __verifyFileName: function(fileName, callback){
        if(!fileName || typeof fileName != "string"){
            callback(new Error("No fileId specified."));
            return;
        }

        if(fileName.length < folderNameSize){
            callback(new Error("FileId to small. "+fileName));
            return;
        }

        return true;
    },
    __ensureFolderStructure: function(folder, callback){
        $$.ensureFolderExists(folder, callback);
    },
    __writeFile: function(readStream, folderPath, fileName, callback){
        this.__getNextVersionFileName(folderPath, fileName, (err, nextVersionFileName) => {
            if(err) {
                console.error(err);
                return callback(err);
            }

            const writeStream = fs.createWriteStream(path.join(folderPath, nextVersionFileName.toString()), {autoClose: false});

            writeStream.on("finish", function() {
                writeStream.close();
                callback(...arguments);
            });
            writeStream.on("error", function() {
                console.error(arguments);
				writeStream.close();
                callback(...arguments);
            });
			//
            readStream.pipe(writeStream);
        });
    },
    __getNextVersionFileName: function (folderPath, fileName, callback) {
        this.__getLatestVersionNameOfFile(folderPath, (err, fileVersion) => {
            if(err) {
                console.error(err);
                return callback(err);
            }

            callback(undefined, fileVersion + 1);
        });
    },
    __getLatestVersionNameOfFile: function (folderPath, callback) {
        fs.readdir(folderPath, (err, files) => {
            if (err) {
                console.error(err);
                callback(err);
                return;
            }

            let fileVersion = 0;

            if(files.length > 0) {
                try {
                    const latestFile = this.__maxElement(files);
                    fileVersion = parseInt(latestFile);
                } catch (e) {
                    e.code = 'invalid_file_name_found';
                    callback(e);
                }
            }

            callback(undefined, fileVersion);
        });
    },
    __maxElement: function (numbers) {
        let max = numbers[0];

        for(let i = 1; i < numbers.length; ++i) {
            max = Math.max(max, numbers[i]);
        }

        if(isNaN(max)) {
            throw new Error('Invalid element found');
        }

        return max;
    },
    __readFile: function(writeFileStream, filePath, callback){
        const readStream = fs.createReadStream(filePath);

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