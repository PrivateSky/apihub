const fs = require('fs');
const path = require('path');
const rootFolder = process.env.ROOT_FILE_UPLOAD || path.resolve("./FileUploads");

module.exports.upload = function (req, callback) {
    const readFileStream = req;
    if(!readFileStream || !readFileStream.pipe || typeof readFileStream.pipe !== "function"){
        callback(new Error("Something wrong happened"));
        return;
    }

    const folder = req.params.folder;
    let filename = req.params.fileId;
    if (filename.split('.').length > 1){
        return callback('err');
    }
    const completeFolderPath = path.join( rootFolder, folder );

    contentType = req.headers['content-type'].split('/');

    if (contentType[0] === 'image') {
        filename += '.' + contentType[1];
    }else {
        return callback('err');
    }

    try {
        fs.mkdirSync(completeFolderPath, {recursive: true});
    }catch (e) {
        return callback(e);
    }
    const writeStream = fs.createWriteStream( path.join(completeFolderPath, filename) );

    writeStream.on('finish', () => {
        return callback();
    });

    writeStream.on('error', (err) => {
        writeStream.close();
        req.close();
        return callback(err);
    });
    req.pipe(writeStream);
};
module.exports.download = function (req, callback) {
    const readFileStream = req;
    if(!readFileStream || !readFileStream.pipe || typeof readFileStream.pipe !== "function"){
        callback(new Error("Something wrong happened"));
        return;
    }

    let folder = req.params.folder;
    let filename = req.params.fileId;
    let completeFolderPath = path.join( rootFolder, folder );
    const filePath = path.join(completeFolderPath, filename);

    if (fs.existsSync(filePath)) {
        const fileToSend = fs.createReadStream(filePath);
        return callback(null ,fileToSend);
    }
    else {
        return callback('err');
    }
};