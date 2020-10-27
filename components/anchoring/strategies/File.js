const fs = require('fs');
const endOfLine = require('os').EOL;
const path = require('swarmutils').path;

const ALIAS_SYNC_ERR_CODE = 'sync-error';

let anchorsFolders;

$$.flow.describe('FS', {
    init: function (rootFolder, folderName) {
        const storageFolder = path.join(rootFolder || server.rootFolder, folderName || 'anchors');
        anchorsFolders = path.resolve(storageFolder);
        try {
            if (!fs.existsSync(anchorsFolders)) {
                fs.mkdirSync(anchorsFolders, { recursive: true });
            }
        } catch (e) {
            throw e;
        }
    },

    addAlias: function (fileHash, request, callback) {

        // get request.body
        // requestToCommand (data {  jSON.... }, request, (err, res) => {
            // callback(err, res.body) <--- de ascuns in requestCommand
        // }) ) - apel syncron


        if (!fileHash || typeof fileHash !== 'string') {
            return callback(new Error('No fileId specified.'));
        }
        const filePath = path.join(anchorsFolders, fileHash);

        fs.stat(filePath, (err, stats) => {
            if (err) {
                if (err.code !== 'ENOENT') {
                    console.log(err);
                }
                fs.writeFile(filePath, request.body.hash.new + endOfLine, callback);
                return;
            }

            this.__appendHash(filePath, request.body.hash.new, {
                lastHash: request.body.hash.last,
                fileSize: stats.size
            }, callback);
        });
    },

    readVersions: function (alias, callback) {
        const filePath = path.join(anchorsFolders, alias);

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
                return callback(err);
            }

            fs.read(fd, Buffer.alloc(options.fileSize), 0, options.fileSize, null, (err, bytesRead, buffer) => {
                if (err) {
                    console.log(err)

                    return callback(err);
                }
                // compare the last hash in the file with the one received in the request
                // if they are not the same, exit with error
                const hashes = buffer.toString().trimEnd().split(endOfLine);
                const lastHash = hashes[hashes.length - 1];

                if (lastHash !== options.lastHash) {
                    console.log('ops', lastHash, options.lastHash)

                    return callback({
                        code: ALIAS_SYNC_ERR_CODE,
                        message: 'Unable to add alias: versions out of sync.'
                    });
                }

                fs.write(fd, hash + endOfLine, options.fileSize, (err) => {
                    if (err) {
                        console.log('write', err)
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
}