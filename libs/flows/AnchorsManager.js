const pathModule = "path";
const path = require(pathModule);
const fsModule = "fs";
const fs = require(fsModule);
const osModule = "os";
const endOfLine = require(osModule).EOL;
let anchorsFolders;
$$.flow.describe("AnchorsManager", {
    init: function (rootFolder) {
        rootFolder = path.resolve(rootFolder);
        anchorsFolders = rootFolder;
        try{
            fs.mkdirSync(anchorsFolders, {recursive: true});
        }catch (e) {
            throw e;
        }
    },

    addAlias: function (fileHash, readStream, callback) {
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
            fs.access(filePath, (err) => {
                if (err) {
                    fs.writeFile(filePath, fileHash + endOfLine, callback);
                } else {
                    fs.appendFile(filePath, fileHash + endOfLine, callback);
                }
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