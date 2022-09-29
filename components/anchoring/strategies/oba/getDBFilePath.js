const path = require("path");

const getDBFilePath = (server) => {
    const BASE_FOLDER = path.join(server.rootFolder, "external-volume", "oba");
    const storageFilePath = path.join(BASE_FOLDER, "pendingAnchors");

    return storageFilePath;
}

module.exports = {
    getDBFilePath
}