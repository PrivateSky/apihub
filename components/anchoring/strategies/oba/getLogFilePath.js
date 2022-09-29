const path = require("path");

const getLogFilePath = (server) => {
    const BASE_FOLDER = path.join(server.rootFolder, "external-volume", "oba");
    const LOG_FILE = path.join(BASE_FOLDER, "oba.log");

    return LOG_FILE;
}

module.exports = {
    getLogFilePath
}