let fs = require('fs');
let path = require('path');
const rootFolder = process.env.ROOT_FILE_UPLOAD || "./FileUploades";

module.exports.upload = function (req, callback) {
    let readFileStream = req;
    if(!readFileStream || !readFileStream.pipe || typeof readFileStream.pipe !== "function"){
        callback(new Error("Something wrong happened"));
        return;
    }

    let folder = req.params.folder;
    let filename = req.params.fileId;
    let completeFolderPath = path.join(rootFolder, folder);

    try {
        fs.mkdirSync(completeFolderPath, {recursive: true});
    }catch (e) {
        callback(e);
        return;
    }

    fs.writeFile(path.join(completeFolderPath,filename), req.body, (err)=>{
        if(err){
            console.log(err);
            return callback('Error on file upload');
        }
        return callback();
    });
};
module.exports.download = function (req, callback) {

};