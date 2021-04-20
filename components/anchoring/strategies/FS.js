const fs = require('fs');
const endOfLine = require('os').EOL;
const path = require('swarmutils').path;
const openDSU = require("opendsu");
const {parse, createTemplateKeySSI} = openDSU.loadApi("keyssi");

const ALIAS_SYNC_ERR_CODE = 'sync-error';

//dictionary. key - domain, value path
let folderStrategy = {};

$$.flow.describe('FS', {
    init: function (domainConfig, anchorId, jsonData, rootFolder) {
        const domainName = this.__getDomainName(anchorId);
        this.commandData = {};
        this.commandData.option = domainConfig.option;
        this.commandData.domain = domainName;
        this.commandData.anchorId = anchorId;
        this.commandData.jsonData = jsonData;
        //config "enableBricksLedger" . default false, even if it is not configured
        this.commandData.EnableBricksLedger = typeof domainConfig.option.enableBricksLedger === 'undefined' ? false : domainConfig.option.enableBricksLedger;
        //because we work instance based, ensure that folder structure is done only once per domain
        //skip, folder structure is already done for this domain type
        if (!folderStrategy[domainName]) {
            const storageFolder = path.join(rootFolder, domainConfig.option.path);
            folderStrategy[domainName] = storageFolder;
            this.__prepareFolderStructure(storageFolder, domainName);
        }
    },
    __getDomainName: function (keySSI) {
        return require('../utils/index').getDomainFromKeySSI(keySSI);
    },
    __prepareFolderStructure: function (storageFolder, domainName) {
        folderStrategy[domainName] = path.resolve(storageFolder);
        try {
            if (!fs.existsSync(folderStrategy[domainName])) {
                fs.mkdirSync(folderStrategy[domainName], {recursive: true});
            }
        } catch (e) {
            console.log('error creating anchoring folder', e);
            throw e;
        }
    },
    addAlias: function (server, callback) {
        const self = this;
        const anchorId = this.commandData.anchorId;
        const anchorKeySSI = parse(anchorId)
        const rootKeySSITypeName = anchorKeySSI.getRootKeySSITypeName();
        const rootKeySSI = createTemplateKeySSI(rootKeySSITypeName, anchorKeySSI.getDLDomain());

        const {digitalProof, hashLinkIds, zkp} = this.commandData.jsonData;

        const _addAlias = () => {
            const anchorsFolders = folderStrategy[self.commandData.domain];
            if (!anchorId || typeof anchorId !== 'string') {
                return callback(new Error('No fileId specified.'));
            }

            let forbiddenCharacters = new RegExp(/[~`!#$%\^&*+=\-\[\]\\';,/{}|\\":<>\?]/g);
            if (forbiddenCharacters.test(anchorId)) {
                console.log(`Found forbidden characters in anchorId ${anchorId}`);
                return callback(new Error("anchorId contains forbidden characters"));
            }

            const filePath = path.join(anchorsFolders, anchorId);
            fs.stat(filePath, (err, stats) => {
                if (err) {
                    if (err.code !== 'ENOENT') {
                        console.log(err);
                    }
                    fs.writeFile(filePath, hashLinkIds.new + endOfLine, callback);
                    return;
                }

                self.__appendHashLink(filePath, hashLinkIds.new, {
                    lastHashLink: hashLinkIds.last,
                    fileSize: stats.size
                }, callback);
            });


            if (self.commandData.EnableBricksLedger) {
                //send log info
                self.__logWriteRequest(server);
            }
        }

        if (!rootKeySSI.canSign()) {
            return _addAlias()
        }

        let data = anchorId + hashLinkIds.new + zkp;
        if (hashLinkIds.last) {
            data += hashLinkIds.last;
        }

        let validAnchor;
        try {
            validAnchor = this.__verifySignature(anchorKeySSI, hashLinkIds.new, hashLinkIds.last);
        } catch (e) {
            return callback({error: e, code: 403});
        }
        if (!validAnchor) {
            return callback({error: Error("Failed to verify signature"), code: 403});
        }

        if (anchorKeySSI.getTypeName() === openDSU.constants.KEY_SSIS.ZERO_ACCESS_TOKEN_SSI) {
            return this.__validateZatSSI(anchorKeySSI, hashLinkIds.new, server, (err, isValid) => {
                if (err) {
                    return callback({error: err, code: 403});
                }

                _addAlias();
            });
        }
        _addAlias();
    },

    __verifySignature(anchorKeySSI, newSSIIdentifier, lastSSIIdentifier) {
        const newSSI = openDSU.loadAPI("keyssi").parse(newSSIIdentifier);
        const timestamp = newSSI.getTimestamp();
        const signature = newSSI.getSignature();
        let dataToVerify = timestamp;
        if (lastSSIIdentifier) {
            dataToVerify = lastSSIIdentifier + dataToVerify;
        }

        if (newSSI.getTypeName() === openDSU.constants.KEY_SSIS.SIGNED_HASH_LINK_SSI) {
            dataToVerify += anchorKeySSI.getIdentifier();
            return anchorKeySSI.verify(dataToVerify, signature)
        }
        if (newSSI.getTypeName() === openDSU.constants.KEY_SSIS.TRANSFER_SSI) {
            dataToVerify += newSSI.getSpecificString();
            return anchorKeySSI.verify(dataToVerify, signature);
        }

        throw Error(`Invalid newSSI type provided`);
    },

    __validateZatSSI(zatSSI, newSSIIdentifier, server, callback){
        const newSSI = openDSU.loadAPI("keyssi").parse(newSSIIdentifier);
        this.readVersions(zatSSI.getIdentifier(), server, (err, SSIs) => {
            if (err) {
                return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to get versions for <${zatSSI.getIdentifier()}>`, err));
            }

            if (SSIs.length === 0) {
                return callback(undefined, true);
            }

            let lastTransferSSI;
            for (let i = SSIs.length - 1; i >= 0; i--) {
                const ssi = openDSU.loadAPI("keyssi").parse(SSIs[i]);
                if (ssi.getTypeName() === openDSU.constants.KEY_SSIS.TRANSFER_SSI) {
                    lastTransferSSI = ssi;
                    break;
                }
            }

            if (lastTransferSSI.getPublicKeyHash() !== newSSI.getPublicKeyHash()) {
                return callback(Error("Failed to validate ZATSSI"), false);
            }

            callback(undefined, true);
        });
    },
    __logWriteRequest: function (server) {
        const runCommandBody = {
            "commandType": "anchor",
            "data": this.commandData
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
        } catch (err) {
            console.log("anchoring ", err);
        }
    },

    readVersions: function (alias, server, callback) {
        const anchorsFolders = folderStrategy[this.commandData.domain];
        const filePath = path.join(anchorsFolders, alias);
        fs.readFile(filePath, (err, fileHashes) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    return callback(undefined, []);
                }
                return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to read file <${filePath}>`, err));
            }
            callback(undefined, fileHashes.toString().trimEnd().split(endOfLine));
        });
    },

    /**
     * Append `hash` to file only
     * if the `lastHashLink` is the last hash in the file
     *
     * @param {string} path
     * @param {string} hash
     * @param {object} options
     * @param {string|undefined} options.lastHashLink
     * @param {number} options.fileSize
     * @param {callback} callback
     */
    __appendHashLink: function (path, hash, options, callback) {
        fs.open(path, fs.constants.O_RDWR, (err, fd) => {
            if (err) {
                return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to append hash <${hash}> in file at path <${path}>`, err));
            }

            fs.read(fd, $$.Buffer.alloc(options.fileSize), 0, options.fileSize, null, (err, bytesRead, buffer) => {
                if (err) {
                    return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed read file <${path}>`, err));
                }
                // compare the last hash in the file with the one received in the request
                // if they are not the same, exit with error
                const hashes = buffer.toString().trimEnd().split(endOfLine);
                const lastHashLink = hashes[hashes.length - 1];

                if (lastHashLink !== options.lastHashLink) {
                    // TODO
                    // options.lastHashLink === null
                    const opendsu = require("opendsu");
                    const keySSISpace = opendsu.loadAPI("keyssi");
                    if (lastHashLink) {
                        const lastSSI = keySSISpace.parse(lastHashLink);
                        if (lastSSI.getTypeName() === opendsu.constants.KEY_SSIS.TRANSFER_SSI) {
                            return __writeNewSSI();
                        }
                    }
                    console.log('__appendHashLink error.Unable to add alias: versions out of sync.', lastHashLink, options.lastHashLink);
                    console.log("existing hashes :", hashes);
                    console.log("received hashes :", options);
                    return callback({
                        code: ALIAS_SYNC_ERR_CODE,
                        message: 'Unable to add alias: versions out of sync'
                    });
                }

                function __writeNewSSI() {
                    fs.write(fd, hash + endOfLine, options.fileSize, (err) => {
                        if (err) {
                            console.log("__appendHashLink-write : ", err);
                            return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed write in file <${path}>`, err));
                        }

                        fs.close(fd, callback);
                    });

                }

                __writeNewSSI();
            });
        });
    }
});

module.exports = {
    ALIAS_SYNC_ERR_CODE
};
