function FilePersistenceStrategy(rootFolder, configuredPath) {
    const self = this;
    const fileOperations = new FileOperations();
    const FSLock = require("../utils/FSLock");
    const AnchorPathResolver = require("../utils/AnchorPathResolver");
    const anchorPathResolver = new AnchorPathResolver(rootFolder, configuredPath);
    fileOperations.InitializeFolderStructure(rootFolder, configuredPath);

    const fsLocks = {};
    self.prepareAnchoring = (anchorId, callback) => {
        const anchorPath = anchorPathResolver.getAnchorPath(anchorId);
        const fsLock = new FSLock(anchorPath);
        fsLocks[anchorId] = fsLock;
        fsLock.acquireLock(err => {
            if (err) {
                return callback({code: 428, message: "Versions out of sync"})
            }

            callback();
        });
    }

    self.getLastVersion = function (anchorId, callback) {
        fileOperations.isFileNameValid(anchorId, (err) => {
            if (err) {
                return callback(err);
            }
            fileOperations.fileExist(anchorId, (err, exists) => {
                if (err) {
                    return callback(undefined, null);
                }
                if (!exists) {
                    return callback(undefined, null);
                }
                //read the last hashlink for anchorId
                return fileOperations.getlastVersion(anchorId, callback);
            })
        });
    }
    self.getAllVersions = function (anchorId, callback) {
        // read all hashlinks for anchorId
        fileOperations.isFileNameValid(anchorId, (err) => {
            if (err) {
                return callback(err);
            }
            fileOperations.fileExist(anchorId, (err, exists) => {
                if (err) {
                    return callback(undefined, []);
                }
                if (!exists) {
                    return callback(undefined, []);
                }
                //read the last hashlink for anchorId
                return fileOperations.getAllVersions(anchorId, callback);
            })
        });
    }
    self.createAnchor = function (anchorId, anchorValueSSI, callback) {
        fileOperations.isFileNameValid(anchorId, (err) => {
            if (err) {
                return callback(err);
            }
            fileOperations.fileExist(anchorId, (err, exists) => {
                if (err) {
                    return callback(err);
                }
                if (!exists) {
                    //file doesnt exist
                    return fileOperations.createAnchor(anchorId, anchorValueSSI, callback);
                }
                //if anchor exist, return error
                return callback(Error(`anchor ${anchorId} already exist`));
            })
        });
    }
    self.appendAnchor = function (anchorId, anchorValueSSI, callback) {
        const anchorPath = anchorPathResolver.getAnchorPath(anchorId);
        const fsLock = fsLocks[anchorId]
        fsLock.isMyLock((err, isMyLock) => {
            if (err) {
                return callback(err);
            }

            if (!isMyLock) {
                return callback(Error(`File ${anchorPath} is locked by another process.`))
            }

            fileOperations.isFileNameValid(anchorId, (err) => {
                if (err) {
                    return callback(err);
                }
                fileOperations.fileExist(anchorId, (err, exists) => {
                    if (err) {
                        return callback(err);
                    }
                    if (!exists) {
                        return callback(new Error(`Anchor ${anchorId} doesn't exist`));
                    }
                    return fileOperations.appendAnchor(anchorId, anchorValueSSI, err => {
                        if (err) {
                            return callback(err);
                        }

                        fsLock.releaseLock(callback);
                    });
                })
            });
        })
    }
}


function FileOperations() {
    const self = this;
    const fs = require('fs');
    const path = require('path');
    let anchoringFolder;
    const endOfLine = require("os").EOL;
    const logger = $$.getLogger("FileOperations", "apihub/anchoring");
    self.InitializeFolderStructure = function (rootFolder, configuredPath) {
        let storageFolder = path.join(rootFolder, configuredPath);
        anchoringFolder = path.resolve(storageFolder);
        try {
            if (!fs.existsSync(anchoringFolder)) {
                fs.mkdirSync(anchoringFolder, {recursive: true});
            }
        } catch (e) {
            logger.error("error creating anchoring folder", e);
            throw new Error(`Failed to create folder ${anchoringFolder}`);
        }
    }

    self.isFileNameValid = function (anchorId, callback) {
        if (!anchorId || typeof anchorId !== "string") {
            return callback(new Error("No fileId specified."));
        }

        let forbiddenCharacters = new RegExp(/[~`!#$%\^&*+=\-\[\]\\';,/{}|\\":<>\?]/g);
        if (forbiddenCharacters.test(anchorId)) {
            logger.error(`Found forbidden characters in anchorId ${anchorId}`);
            return callback(new Error(`anchorId ${anchorId} contains forbidden characters`));
        }
        return callback(undefined);
    }

    self.fileExist = function (anchorId, callback) {
        const filePath = path.join(anchoringFolder, anchorId);
        fs.stat(filePath, (err) => {
            if (err) {
                if (err.code === "ENOENT") {
                    return callback(undefined, false);
                }
                return callback(err, false);
            }
            return callback(undefined, true);
        });
    }

    self.getlastVersion = function (anchorId, callback) {
        self.getAllVersions(anchorId, (err, allVersions) => {
            if (err) {
                return callback(err);
            }
            if (allVersions.length === 0) {
                return callback(undefined, null);
            }
            return callback(undefined, allVersions[allVersions.length - 1]);
        });
    }

    self.getAllVersions = function (anchorId, callback) {
        const filePath = path.join(anchoringFolder, anchorId);
        fs.readFile(filePath, (err, fileHashes) => {
            if (err) {
                return callback(new Error(`Failed to read file <${filePath}>`));
            }
            const fileContent = fileHashes.toString().trimEnd();
            const versions = fileContent ? fileContent.split(endOfLine) : [];
            callback(undefined, versions);
        });
    }

    self.createAnchor = function (anchorId, anchorValueSSI, callback) {
        const fileContent = anchorValueSSI + endOfLine;
        const filePath = path.join(anchoringFolder, anchorId);
        fs.writeFile(filePath, fileContent, callback);
    }

    self.appendAnchor = function (anchorId, anchorValueSSI, callback) {
        const fileContent = anchorValueSSI + endOfLine;
        const filePath = path.join(anchoringFolder, anchorId);
        fs.appendFile(filePath, fileContent, callback);
    }
}


module.exports = {
    FilePersistenceStrategy
}
