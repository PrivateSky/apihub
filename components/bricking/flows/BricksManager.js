const fs = require('fs');
const path = require('swarmutils').path;
const openDSU = require("opendsu");
const crypto = openDSU.loadApi("crypto");

const folderNameSize = process.env.FOLDER_NAME_SIZE || 5;

//key - domain
//value - folder
let bricksFolders = {};

$$.flow.describe('BricksManager', {
    init: function (domainConfig, domain, serverRootFolder) {
        this.domain = domain;
        if (typeof bricksFolders[domain] === 'undefined') {
            bricksFolders[domain] = path.join(serverRootFolder, domainConfig.path);
            this.__ensureFolderStructure(bricksFolders[domain]);
        }
    },
    write: function (readFileStream, callback) {
        this.__convertStreamToBuffer(readFileStream, (err, brickData) => {
            if (err) {
                return callback(createOpenDSUErrorWrapper(`Failed to convert stream to buffer`, err));
            }
            const fileName = crypto.sha256(brickData);
            if (!this.__verifyFileName(fileName, callback)) {
                return;
            }

            const folderName = path.join(bricksFolders[this.domain], fileName.substr(0, folderNameSize));

            this.__ensureFolderStructure(folderName, (err) => {
                if (err) {
                    return callback(createOpenDSUErrorWrapper(`Failed to create folder structure <${folderName}>`, err));
                }

                this.__writeFile(brickData, folderName, fileName, callback);
            });
        });
    },
    read: function (fileName, writeFileStream, callback) {
        if (!this.__verifyFileName(fileName, callback)) {
            return;
        }

        const folderPath = path.join(bricksFolders[this.domain], fileName.substr(0, folderNameSize));
        const filePath = path.join(folderPath, fileName);

        this.__verifyFileExistence(filePath, (err, result) => {
            if (!err) {
                this.__readFile(writeFileStream, filePath, callback);
            } else {
                callback(new Error(`File ${filePath} was not found.`));
            }
        });
    },
    readMultipleBricks: function (brickHashes, writeStream, callback) {
        if (!Array.isArray(brickHashes)) {
            brickHashes = [brickHashes];
        }
        this.__writeMultipleBricksToStream(brickHashes, 0, writeStream, callback);
    },
    __writeBrickDataToStream: function (brickData, writeStream, callback) {
        const brickSize = $$.Buffer.alloc(4);
        brickSize.writeUInt32BE(brickData.length);
        writeStream.write(brickSize, (err) => {
            if (err) {
                return callback(err);
            }

            writeStream.write(brickData, callback);
        });
    },
    __writeMultipleBricksToStream: function (brickHashes, brickIndex, writeStream, callback) {
        const brickHash = brickHashes[brickIndex];
        this.__readBrick(brickHash, (err, brickData) => {
            if (err) {
                return callback(createOpenDSUErrorWrapper(`Failed to read brick <${brickHash}>`, err));
            }
            this.__writeBrickDataToStream(brickData, writeStream, (err) => {
                if (err) {
                    return callback(createOpenDSUErrorWrapper(`Failed to write brick data to stream `, err));
                }
                brickIndex++;
                if (brickIndex === brickHashes.length) {
                    callback();
                } else {
                    this.__writeMultipleBricksToStream(brickHashes, brickIndex, writeStream, callback);
                }
            });
        });
    },
    __readBrick: function (brickHash, callback) {
        const folderPath = path.join(bricksFolders[this.domain], brickHash.substr(0, folderNameSize));
        const filePath = path.join(folderPath, brickHash);
        this.__verifyFileExistence(filePath, (err) => {
            if (err) {
                return callback(createOpenDSUErrorWrapper(`File <${filePath}> does not exist.`, err));
            }

            fs.readFile(filePath, callback);
        });
    },
    __verifyFileName: function (fileName, callback) {
        if (!fileName || typeof fileName !== 'string') {
            return callback(new Error('No fileId specified.'));
        }

        if (fileName.length < folderNameSize) {
            return callback(new Error(`FileId too small. ${fileName}`));
        }

        return true;
    },
    __ensureFolderStructure: function (folder, callback) {
        try {
            fs.mkdirSync(folder, {recursive: true});
        } catch (err) {
            if (callback) {
                callback(err);
            } else {
                throw err;
            }
        }
        if (callback) {
            callback();
        }
    },
    __writeFile: function (brickData, folderPath, fileName, callback) {
        const filePath = path.join(folderPath, fileName);
        fs.access(filePath, (err) => {
            if (err) {
                fs.writeFile(filePath, brickData, (err) => {
                    callback(err, fileName)
                });
            } else {
                callback(undefined, fileName);
            }
        });
    },
    __readFile: function (writeFileStream, filePath, callback) {
        const readStream = fs.createReadStream(filePath);

        writeFileStream.on('finish', callback);
        writeFileStream.on('error', callback);

        readStream.pipe(writeFileStream);
    },
    __verifyFileExistence: function (filePath, callback) {
        fs.access(filePath, callback);
    },
    __convertStreamToBuffer: function (readStream, callback) {
        const buffs = [];
        readStream.on('data', (chunk) => {
            buffs.push(chunk);
        });

        readStream.on('error', (err) => {
            return callback(err);
        });

        readStream.on('end', () => {
            const brickData = $$.Buffer.concat(buffs);
            return callback(undefined, brickData);
        });
    }
});
