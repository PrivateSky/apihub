const fs = require('fs');
const endOfLine = require('os').EOL;
const path = require('swarmutils').path;

const ALIAS_SYNC_ERR_CODE = 'sync-error';

let folderStrategy = [];

$$.flow.describe('FS', {
    init: function (strategy, anchorId, jsonData, rootFolder) {
            this.commandData = {};
            this.commandData.option = strategy.option;
            this.commandData.anchorId = anchorId;
            this.commandData.jsonData = jsonData;
            const folderPrepared = folderStrategy.find(elem => elem.type === strategy.type);

            //because we work instance based, ensure that folder structure is done only once per strategy type
            if (folderPrepared && folderPrepared.IsDone === true)
            {
                //skip, folder structure is already done for this strategy type
            } else {
                folderStrategy.push({
                    "IsDone" : false,
                    "type" : strategy.type
                });
                let storageFolder = path.join(rootFolder, strategy.option.path);
                if (typeof process.env.ANCHOR_STORAGE_FOLDER !== 'undefined') {
                    storageFolder = process.env.ANCHOR_STORAGE_FOLDER;
                }
                this.__prepareFolderStructure(storageFolder);
            };


    },

    __prepareFolderStructure: function (storageFolder) {
        this.anchorsFolders = path.resolve(storageFolder);
        try {
            if (!fs.existsSync(this.anchorsFolders)) {
                fs.mkdirSync(this.anchorsFolders, { recursive: true });
            }
        } catch (e) {
            console.log('error creating anchoring folder', e);
            throw e;
        }
    },
    addAlias : function (server, callback) {
        const fileHash = this.commandData.anchorId;
        if (!fileHash || typeof fileHash !== 'string') {
            return callback(new Error('No fileId specified.'));
        }
        const filePath = path.join(this.anchorsFolders, fileHash);
        fs.stat(filePath, (err, stats) => {
            if (err) {
                if (err.code !== 'ENOENT') {
                    console.log(err);
                }
                fs.writeFile(filePath, this.commandData.jsonData.hash.new + endOfLine, callback);
                return;
            }

            this.__appendHash(filePath, this.commandData.jsonData.hash.new, {
                lastHash: this.commandData.jsonData.hash.last,
                fileSize: stats.size
            }, callback);
        });

        //send log info
        this.__logWriteRequest(server);
    },

    __logWriteRequest : function(server){
        const runCommandBody = {
            "commandType" : "anchor",
            "data" : this.commandData
        };
        const bodyData = JSON.stringify(runCommandBody);
        //build path
        const runCommandPath = require('../../bricksLedger/constants').URL_PREFIX + '/runCommand';
        //run Command method
        const runCmdMethod = 'POST';
        // run Command headers
        const runCmdHeaders = {
            'Content-Type': 'application/json',
            'Content-Length': bodyData.length
        };
        try {
            server.makeLocalRequest(runCmdMethod, runCommandPath, bodyData, runCmdHeaders, (err, result) => {
                //callback is for local only if we register only access logs
                if (err) {
                    console.log(err);
                }
                //console.log(result);
            })
        }catch (err) {
            console.log("anchoring ",err);
        };
    },

    readVersions: function (alias,server, callback) {
        const filePath = path.join(this.anchorsFolders, alias);
        fs.readFile(filePath, (err, fileHashes) => {
            if (err) {
                if (err.code === 'ENOENT') {
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
        fs.open(path, fs.constants.O_RDWR, (err, fd) => {
            if (err) {
                console.log("__appendHash-open-error : ",err);
                return callback(err);
            }

            fs.read(fd, Buffer.alloc(options.fileSize), 0, options.fileSize, null, (err, bytesRead, buffer) => {
                if (err) {
                    console.log("__appendHash-read-error : ",err);

                    return callback(err);
                }
                // compare the last hash in the file with the one received in the request
                // if they are not the same, exit with error
                const hashes = buffer.toString().trimEnd().split(endOfLine);
                const lastHash = hashes[hashes.length - 1];

                if (lastHash !== options.lastHash) {
                    console.log('__appendHash error.Unable to add alias: versions out of sync.', lastHash, options.lastHash)
                    console.log("existing hashes :", hashes);
                    console.log("received hashes :", options);
                    return callback({
                        code: ALIAS_SYNC_ERR_CODE,
                        message: 'Unable to add alias: versions out of sync'
                    });
                }

                fs.write(fd, hash + endOfLine, options.fileSize, (err) => {
                    if (err) {
                        console.log("__appendHash-write : ",err);
                        return callback(err);
                    }
                    
                    fs.close(fd, callback);
                });
            });
        });
    }
});

module.exports = {
    ALIAS_SYNC_ERR_CODE
};