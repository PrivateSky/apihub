const fs = require('fs');
const path = require("swarmutils").path;
const config = require('../../../config');

function sendResult(resHandler, resultStream) {
    resHandler.statusCode = 200;
    resultStream.pipe(resHandler);

    resultStream.on('finish', () => {
        resHandler.end();
    });
}

function downloadFile(req, res) {
    download(req, res, (err, result) => {
        if (err) {
            res.statusCode = 404;
            res.end();
        } else {
            sendResult(res, result);
        }
    });
}

function download(req, res, callback) {
    const readFileStream = req;
    if (!readFileStream || !readFileStream.pipe || typeof readFileStream.pipe !== "function") {
        callback(new Error("Something wrong happened"));
        return;
    }

    const folder = $$.Buffer.from(req.params.filepath, 'base64').toString().replace('\n', '');
    const completeFolderPath = path.join(config.getConfig('storage'), folder);

    if (folder.includes('..')) {
        return callback(new Error("invalidPath"));
    }

    if (fs.existsSync(completeFolderPath)) {
        const fileToSend = fs.createReadStream(completeFolderPath);
        res.setHeader('Content-Type', `image/${folder.split('.')[1]}`);
        return callback(null, fileToSend);
    }

    return callback(new Error("PathNotFound"));
}

module.exports = downloadFile;
