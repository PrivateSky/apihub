const fs = require("fs");
const endOfLine = require("os").EOL;
const path = require("swarmutils").path;
const openDSU = require("opendsu");
const { parse, createTemplateKeySSI } = openDSU.loadApi("keyssi");

const { verifySignature, logWriteRequest, appendHashLink } = require("./utils");
const { ANCHOR_ALREADY_EXISTS_ERR_CODE, getDomainFromKeySSI } = require("../../utils");

//dictionary. key - domain, value path
let folderStrategy = {};

function prepareFolderStructure(storageFolder, domainName) {
    folderStrategy[domainName] = path.resolve(storageFolder);
    try {
        if (!fs.existsSync(folderStrategy[domainName])) {
            fs.mkdirSync(folderStrategy[domainName], { recursive: true });
        }
    } catch (e) {
        console.log("error creating anchoring folder", e);
        throw e;
    }
}

class FS {
    constructor(server, domainConfig, anchorId, jsonData) {
        const domainName = getDomainFromKeySSI(anchorId);
        this.commandData = {};
        this.commandData.option = domainConfig.option;
        this.commandData.domain = domainName;
        this.commandData.anchorId = anchorId;
        this.commandData.jsonData = jsonData || {};
        this.commandData.enableBricksLedger =
            typeof domainConfig.option.enableBricksLedger === "undefined"
                ? false
                : domainConfig.option.enableBricksLedger;

        //because we work instance based, ensure that folder structure is done only once per domain
        //skip, folder structure is already done for this domain type
        if (!folderStrategy[domainName]) {
            const rootFolder = server.rootFolder;
            const storageFolder = path.join(rootFolder, domainConfig.option.path);
            folderStrategy[domainName] = storageFolder;
            prepareFolderStructure(storageFolder, domainName);
        }
    }

    createAnchor(callback) {
        this._createOrUpdateAnchor(true, callback);
    }

    createNFT(callback) {
        this._createOrUpdateAnchor(true, callback);
    }

    appendToAnchor(callback) {
        this._createOrUpdateAnchor(false, callback);
    }

    getAllVersions(callback) {
        const { anchorId } = this.commandData;
        this._getAllVersionsForAnchorId(anchorId, callback);
    }

    getLatestVersion(callback) {
        this.getAllVersions((err, results) => {
            if (err) {
                return callback(err);
            }

            const lastVersion = results && results.length ? results[results.length - 1] : null;
            callback(null, lastVersion);
        });
    }

    _createOrUpdateAnchor(createWithoutVersion, callback) {
        const self = this;
        const anchorId = this.commandData.anchorId;
        let anchorKeySSI;

        try {
            anchorKeySSI = parse(anchorId);
        } catch (e) {
            return callback({ error:e, code: 500 });
        }
        const rootKeySSITypeName = anchorKeySSI.getRootKeySSITypeName();
        const rootKeySSI = createTemplateKeySSI(rootKeySSITypeName, anchorKeySSI.getDLDomain());

        if (createWithoutVersion || !rootKeySSI.canSign()) {
            return this._writeToAnchorFile(createWithoutVersion, callback);
        }

        const { hashLinkIds } = this.commandData.jsonData;

        let validAnchor;
        try {
            validAnchor = verifySignature(anchorKeySSI, hashLinkIds.new, hashLinkIds.last);
        } catch (e) {
            return callback({ error: e, code: 403 });
        }
        if (!validAnchor) {
            return callback({ error: Error("Failed to verify signature"), code: 403 });
        }

        if (anchorKeySSI.getTypeName() === openDSU.constants.KEY_SSIS.ZERO_ACCESS_TOKEN_SSI) {
            return this._validateZatSSI(anchorKeySSI, hashLinkIds.new, (err, isValid) => {
                if (err) {
                    return callback({ error: err, code: 403 });
                }

                this._writeToAnchorFile(createWithoutVersion, callback);
            });
        }
        this._writeToAnchorFile(createWithoutVersion, callback);
    }

    _writeToAnchorFile = (createWithoutVersion, callback) => {
        const {
            anchorId,
            domain,
            enableBricksLedger,
            jsonData: { hashLinkIds },
        } = this.commandData;

        const anchorsFolders = folderStrategy[domain];
        if (!anchorId || typeof anchorId !== "string") {
            return callback(new Error("No fileId specified."));
        }

        let forbiddenCharacters = new RegExp(/[~`!#$%\^&*+=\-\[\]\\';,/{}|\\":<>\?]/g);
        if (forbiddenCharacters.test(anchorId)) {
            console.log(`Found forbidden characters in anchorId ${anchorId}`);
            return callback(new Error(`anchorId ${anchorId} contains forbidden characters`));
        }

        const filePath = path.join(anchorsFolders, anchorId);
        fs.stat(filePath, (err, stats) => {
            if (err) {
                if (err.code !== "ENOENT") {
                    console.log(err);
                }
                const fileContent = createWithoutVersion ? "" : hashLinkIds.new + endOfLine;
                fs.writeFile(filePath, fileContent, callback);
                return;
            }

            if (createWithoutVersion) {
                // the anchor file already exists, so we cannot create another file for the same anchor
                return callback({
                    code: ANCHOR_ALREADY_EXISTS_ERR_CODE,
                    message: `Unable to create anchor for existing anchorId ${anchorId}`,
                });
            }

            appendHashLink(
                filePath,
                hashLinkIds.new,
                {
                    lastHashLink: hashLinkIds.last,
                    fileSize: stats.size,
                },
                callback
            );
        });

        if (enableBricksLedger) {
            //send log info
            logWriteRequest(this.server, this.commandData);
        }
    };

    _getAllVersionsForAnchorId(anchorId, callback) {
        const anchorsFolders = folderStrategy[this.commandData.domain];
        const filePath = path.join(anchorsFolders, anchorId);
        fs.readFile(filePath, (err, fileHashes) => {
            if (err) {
                if (err.code === "ENOENT") {
                    return callback(undefined, []);
                }
                return OpenDSUSafeCallback(callback)(
                    createOpenDSUErrorWrapper(`Failed to read file <${filePath}>`, err)
                );
            }
            const fileContent = fileHashes.toString().trimEnd();
            const versions = fileContent ? fileContent.split(endOfLine) : [];
            callback(undefined, versions);
        });
    }

    _validateZatSSI(zatSSI, newSSIIdentifier, callback) {
        const newSSI = openDSU.loadAPI("keyssi").parse(newSSIIdentifier);
        this._getAllVersionsForAnchorId(zatSSI.getIdentifier(), (err, SSIs) => {
            if (err) {
                return OpenDSUSafeCallback(callback)(
                    createOpenDSUErrorWrapper(`Failed to get versions for <${zatSSI.getIdentifier()}>`, err)
                );
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
    }
}

module.exports = FS;
