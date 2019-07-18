require('launcher');
const FileShare = require('../index');
const Server = require('../../http-wrapper').Server;
const Client = require('../../http-wrapper').Client;
const httpUtils = require('../../http-wrapper').httpUtils;
const fs = require('fs');
const path = require('path');

let client = new Client();
let fileShare = new FileShare(client);
let server = new Server().listen(8080);

function getSharableResourceUrl(request, resourceName) {
    const resourceUrl = '/share/' + resourceName;
    return request.headers.host + resourceUrl;
}

server.post('/share/upload/:fileName', function (request, response) {
    $$.uidGenerator.safe_uuid(function (error, uid) {
        if (error) {
            console.error(error);
        } else {
            const fileExtension = path.extname(request.params.fileName);
            const fileName = uid + fileExtension;
            if (!fs.existsSync('shared_content')) {
                fs.mkdirSync('shared_content');
            }
            const filePath = path.join('shared_content', fileName);
            console.log(`Server: Creating resource ${filePath}`);
            let uploadedFileStream = fs.createWriteStream(filePath);
            request.pipe(uploadedFileStream);
            uploadedFileStream.on('finish', function () {
                console.log(`Server: Successful created resource ${filePath}`);
                const sharableResourceUrl = getSharableResourceUrl(request, fileName);
                response.end(sharableResourceUrl);
            });
        }
    });
});

function uploadCallback(error, response) {
    if (error) {
        console.error(error);
    } else {
        console.log('Client: Successful upload');
        httpUtils.setDataHandler(response, function (error, body) {
            console.log(`Client: Download Link is ${body}`);
        });
    }
}

fileShare.uploadFile('http://localhost:8080/share/upload', './test_file.txt', uploadCallback);
fileShare.uploadFile('http://localhost:8080/share/upload', './test_image.jpeg', uploadCallback);
