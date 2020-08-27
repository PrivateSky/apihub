const fs = require('fs');
const path = require('swarmutils').path;
const crypto = require('pskcrypto');

let brickStorageFolder;
const HASH_ALGORITHM = 'sha256';
const folderNameSize = process.env.FOLDER_NAME_SIZE || 5;

$$.flow.describe('BricksManager', {
    init: function (rootFolder) {
        rootFolder = path.resolve(rootFolder);
        brickStorageFolder = rootFolder;
        this.__ensureFolderStructure(rootFolder);
    },
    write: function (readFileStream, callback) {
        this.__convertStreamToBuffer(readFileStream, (err, brickData) => {
            if (err) {
                return callback(err);
            }
            const fileName = crypto.hash(HASH_ALGORITHM, brickData, 'hex');
            if (!this.__verifyFileName(fileName, callback)) {
                return;
            }


            const folderName = path.join(brickStorageFolder, fileName.substr(0, folderNameSize));

            this.__ensureFolderStructure(folderName, (err) => {
                if (err) {
                    return callback(err);
                }

                this.__writeFile(brickData, folderName, fileName, callback);
            });
        });
    },
    read: function (fileName, writeFileStream, callback) {
        if (!this.__verifyFileName(fileName, callback)) {
            return;
        }

        const folderPath = path.join(brickStorageFolder, fileName.substr(0, folderNameSize));
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
        const brickSize = Buffer.alloc(4);
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
            this.__writeBrickDataToStream(brickData, writeStream, (err) => {
                if (err) {
                    return callback(err);
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
        const folderPath = path.join(brickStorageFolder, brickHash.substr(0, folderNameSize));
        const filePath = path.join(folderPath, brickHash);
        this.__verifyFileExistence(filePath, (err) => {
            if (err) {
                return callback(err);
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
    __convertStreamToBuffer: function (readStream, callback){
        let brickData = Buffer.alloc(0);
        readStream.on('data', (chunk) => {
            brickData = Buffer.concat([brickData, chunk]);
        });

        readStream.on('error', (err) => {
            return callback(err);
        });

        readStream.on('end', () => {
            return callback(undefined, brickData);
        });
    }
});
