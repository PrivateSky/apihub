const fs = require('fs');
const path = require('path');
let rootFolder = process.env.npm_package_config_ROOT_FILE_UPLOAD || process.env.ROOT_FILE_UPLOAD || "./FileUploads";

rootFolder = path.resolve(rootFolder);

guid = function() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    }
  
    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
  };

module.exports.upload = function (req, callback) {
    const readFileStream = req;
    if(!readFileStream || !readFileStream.pipe || typeof readFileStream.pipe !== "function"){
        callback(new Error("Something wrong happened"));
        return;
    }

    const folder = Buffer.from(req.params.folder, 'base64').toString().replace('\n', '');
    if (folder.includes('..')){
        return callback('err');
    }
    let filename = guid();
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
        fs.mkdirSync(completeFolderPath, { recursive: true });
    }catch (e) {
        return callback(e);
    }
    const writeStream = fs.createWriteStream( path.join(completeFolderPath, filename));

    writeStream.on('finish', () => {
        writeStream.close();
        return callback(null, {'path': path.posix.join(folder,filename)});
    });

    writeStream.on('error', (err) => {
        writeStream.close();
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

    const folder = req.params.folder;
    const filename = req.params.fileId;
    const completeFolderPath = path.join( rootFolder, folder );
    const filePath = path.join(completeFolderPath, filename);

    if (fs.existsSync(filePath)) {
        const fileToSend = fs.createReadStream(filePath);
        return callback(null, fileToSend);
    }
    else {
        return callback('err');
    }
};