
const fs = require('fs');
const path = require('swarmutils').path;
const config = require('../../../config');

function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }

    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

function uploadFile(req, res) {
    upload(req, (err, result) => {
        if (err) {
            res.statusCode = 500;
            res.end();
        } else {
            res.statusCode = 200;
            res.end(JSON.stringify(result));
        }
    })
};

function upload(req, callback) {
    const readFileStream = req;
    if (!readFileStream || !readFileStream.pipe || typeof readFileStream.pipe !== "function") {
        return callback(new Error("Something wrong happened"));
    }

    const folder = Buffer.from(req.params.folder, 'base64').toString().replace('\n', '');

    if (folder.includes('..')) {
        return callback('err');
    }

    let filename = guid();

    if (filename.split('.').length > 1) {
        return callback('err');
    }

    const completeFolderPath = path.join(config.getConfig('storage'), folder);

    const contentType = req.headers['content-type'].split('/');

    if (contentType[0] === 'image' || (contentType[0] === 'application' && contentType[1] === 'pdf')) {
        filename += '.' + contentType[1];
    } else {
        return callback('err');
    }

    try {
        fs.mkdirSync(completeFolderPath, { recursive: true });
    } catch (e) {
        return callback(e);
    }

    const writeStream = fs.createWriteStream(path.join(completeFolderPath, filename));

    writeStream.on('finish', () => {
        writeStream.close();
        return callback(null, { 'path': path.posix.join(folder, filename) });
    });

    writeStream.on('error', (err) => {
        writeStream.close();
        return callback(err);
    });

    req.pipe(writeStream);
}

module.exports =  uploadFile;