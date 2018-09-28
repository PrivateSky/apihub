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
    getVersionsForFile: function(fileName, writeFileStream, callback) {
        if(!this.__verifyFileName(fileName, callback)){
            return;
        }

        const folderPath = path.join(rootfolder, fileName.substr(0, folderNameSize), fileName);
        fs.readdir(folderPath, callback)
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
            const writeStream = fs.createWriteStream(path.join(folderPath, nextVersionFileName.toString()), {
                mode:0o444
            });

            writeStream.on("finish", callback);
            writeStream.on("error", callback);

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
    // ToDo: treat errors
    __getLatestVersionNameOfFile: function (folderPath, callback) {
        fs.readdir(folderPath, (err, files) => {
            if (err) {
                console.error(err);
                callback(err);
                return;
            }

            let fileVersion = 0;
            if(files.length > 0) {
                files.sort((left, right) => left.localeCompare(right));

                const latestFile = files[files.length - 1];

                fileVersion = Number.parseInt(latestFile);
            }

            callback(undefined, fileVersion);
        });
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