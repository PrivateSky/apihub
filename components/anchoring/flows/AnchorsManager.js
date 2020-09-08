const path = require("swarmutils").path;
const fsModule = "fs";
const fs = require(fsModule);
const osModule = "os";
const endOfLine = require(osModule).EOL;
let anchorsFolders;

const ALIAS_SYNC_ERR_CODE = 'sync-error';

$$.flow.describe("AnchorsManager", {
    init: function (rootFolder) {
        rootFolder = path.resolve(rootFolder);
        anchorsFolders = rootFolder;
        try {
            if (!fs.existsSync(anchorsFolders)) {
                fs.mkdirSync(anchorsFolders, { recursive: true });
            }
        } catch (e) {
            throw e;
        }
    },

    addAlias: function (fileHash, lastHash, readStream, callback) {
        if (!fileHash || typeof fileHash !== "string") {
            return callback(new Error("No fileId specified."));
        }

        this.__streamToString(readStream, (err, alias) => {
            if (err) {
                return callback(err);
            }
            if (!alias) {
                return callback(new Error("No alias was provided"));
            }

            const filePath = path.join(anchorsFolders, alias);
          
            fs.stat(filePath, (err, stats) => {
                if (err) {
                    fs.writeFile(filePath, fileHash + endOfLine, callback);
                    return;
                }

                this.__appendHash(filePath, fileHash, {
                    lastHash,
                    fileSize: stats.size
                }, callback);
            });

        });
    },

    readVersions: function (alias, callback) {
        const filePath = path.join(anchorsFolders, alias);
        fs.readFile(filePath, (err, fileHashes) => {
            if (err) {
                if (err.code === "ENOENT") {
                    return callback(undefined, []);
                }

                return callback(err);
            }

            callback(undefined, fileHashes.toString().trimEnd().split(endOfLine));
        });
    },

    /**
     * Append `hash` to file only
     * if the `lastHash` is the last hash in the file
     * 
     * @param {string} path 
     * @param {string} hash 
     * @param {object} options
     * @param {string|undefined} options.lastHash 
     * @param {number} options.fileSize 
     * @param {callback} callback 
     */
    __appendHash: function (path, hash, options, callback) {
        if (!options.lastHash) {
            return fs.appendFile(path, hash + endOfLine, callback);
        }

        fs.open(path, fs.constants.O_RDWR, (err, fd) => {
            if (err) {
                return callback(err);
            }

            const readOptions = {
                buffer: Buffer.alloc(options.fileSize),
                offset: 0,
                length: options.fileSize,
                position: null
            };
            fs.read(fd, Buffer.alloc(options.fileSize), 0, options.fileSize, null, (err, bytesRead, buffer) => {
                if (err) {
                    return callback(err);
                }

                // compare the last hash in the file with the one received in the request
                // if they are not the same, exit with error
                const hashes = buffer.toString().trimEnd().split(endOfLine);
                const lastHash = hashes[hashes.length - 1];

                if (lastHash !== options.lastHash) {
                    return callback({
                        code: ALIAS_SYNC_ERR_CODE,
                        message: "Unable to add alias: versions out of sync."
                    });
                }

                fs.write(fd, hash + endOfLine, options.fileSize, (err) => {
                    if (err) {
                        return callback(err);
                    }

                    fs.close(fd, callback);
                });
            });
        });
    },

    __streamToString: function (readStream, callback) {
        let str = '';
        readStream.on("data", (chunk) => {
            str += chunk;
        });

        readStream.on("end", () => {
            callback(undefined, str);
        });

        readStream.on("error", callback);
    }
});

module.exports = {
    ALIAS_SYNC_ERR_CODE
}