require('launcher');
const path = require("path");
const fs = require("fs");
const PskHash = require('pskcrypto').PskHash;

const folderNameSize = process.env.FOLDER_NAME_SIZE || 5;
const FILE_SEPARATOR = '-';
let rootfolder;

$$.flow.describe("CSBmanager", {
    init: function(rootFolder, callback){
        if(!rootFolder){
            callback(new Error("No root folder specified!"));
            return;
        }
        rootFolder = path.resolve(rootFolder);
        this.__ensureFolderStructure(rootFolder, function(err/*, path*/){
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

        const serial = this.serial(() => {}); //TODO: Empty function

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
                    this.__readFile(writeFileStream, path.join(filePath, fileVersion.fullVersion), callback);
                });
            }else{
                return callback(new Error("No file found."));
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
                return callback(new Error("No file found."));
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

            const totalNumberOfFiles = files.length;
            const filesData = [];

            let resolvedFiles = 0;

            for (let i = 0; i < totalNumberOfFiles; ++i) {
                fs.stat(path.join(folderPath, files[i]), (err, stats) => {
                    if (err) {
                        filesData.push({version: files[i], creationTime: null, creationTimeMs: null});
                        return;
                    }

                    filesData.push({version: files[i], creationTime: stats.birthtime, creationTimeMs: stats.birthtimeMs});

                    resolvedFiles += 1;

                    if (resolvedFiles >= totalNumberOfFiles) {
                        filesData.sort((first, second) => {
                            const firstCompareData = first.creationTimeMs || first.version;
                            const secondCompareData = second.creationTimeMs || second.version;

                            return firstCompareData - secondCompareData;
                        });
                        return callback(undefined, filesData);
                    }
                });
            }
        });
    },
    compareVersions: function(bodyStream, callback) {
        let body = '';

        bodyStream.on('data', (data) => {
            body += data;
        });

        bodyStream.on('end', () => {
           try {
               body = JSON.parse(body);
               this.__compareVersions(body, callback);
           } catch (e) {
                return callback(e);
           }
        });
    },
    __verifyFileName: function(fileName, callback){
        if(!fileName || typeof fileName != "string"){
            callback(new Error("No fileId specified."));
            return;
        }

        if(fileName.length < folderNameSize){
            callback(new Error("FileId too small. "+fileName));
            return;
        }

        return true;
    },
    __ensureFolderStructure: function(folder, callback){
        fs.mkdir(folder, {recursive: true},  callback);
    },
    __writeFile: function(readStream, folderPath, fileName, callback){
        this.__getNextVersionFileName(folderPath, fileName, (err, nextVersionFileName) => {
            if(err) {
                console.error(err);
                return callback(err);
            }

            const hash = new PskHash();
            readStream.on('data', (data) => {
                hash.update(data);
            });

            const filePath = path.join(folderPath, nextVersionFileName.toString());
            const writeStream = fs.createWriteStream(filePath, {mode:0o444});

            writeStream.on("finish", () => {
                const hashDigest = hash.digest().toString('hex');
                const newPath = filePath + FILE_SEPARATOR + hashDigest;
                fs.rename(filePath, newPath, callback);
            });

            writeStream.on("error", function() {
				writeStream.close();
				readStream.close();
                callback(...arguments);
            });

            readStream.pipe(writeStream);
        });
    },
    __getNextVersionFileName: function (folderPath, fileName, callback) {
        this.__getLatestVersionNameOfFile(folderPath, (err, fileVersion) => {
            if(err) {
                console.error(err);
                return callback(err);
            }

            callback(undefined, fileVersion.numericVersion + 1);
        });
    },
    __getLatestVersionNameOfFile: function (folderPath, callback) {
        fs.readdir(folderPath, (err, files) => {
            if (err) {
                console.error(err);
                callback(err);
                return;
            }

            let fileVersion = {numericVersion: 0, fullVersion: '0' + FILE_SEPARATOR};

            if(files.length > 0) {
                try {
                    const allVersions = files.map((file) => file.split(FILE_SEPARATOR)[0]);
                    const latestFile = this.__maxElement(allVersions);
                    fileVersion = {
                        numericVersion: parseInt(latestFile),
                        fullVersion: files.filter((file) => file.split(FILE_SEPARATOR)[0] === latestFile.toString())[0]
                    };

                } catch (e) {
                    e.code = 'invalid_file_name_found';
                    return callback(e);
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
    __compareVersions: function (files, callback) {
        const filesWithChanges = [];
        const entries = Object.entries(files);
        let remaining = entries.length;

        if(entries.length === 0) {
            callback(undefined, filesWithChanges);
            return;
        }

        entries.forEach(([ fileName, fileHash ]) => {
            this.getVersionsForFile(fileName, (err, versions) => {
                if (err) {
                    if(err.code === 'ENOENT') {
                        versions = [];
                    } else {
                        return callback(err);
                    }

                }

                const match = versions.some((version) => {
                    const hash = version.version.split(FILE_SEPARATOR)[1];
                    return hash === fileHash;
                });

                if (!match) {
                    filesWithChanges.push(fileName);
                }

                if (--remaining === 0) {
                    return callback(undefined, filesWithChanges);
                }
            });
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