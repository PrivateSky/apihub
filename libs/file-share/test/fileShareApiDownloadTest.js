const FileShare = require('../index');
const Server = require('./../../http-wrapper').Server;
const Client = require('./../../http-wrapper').Client;
const fs = require('fs');
const path = require('path');

let client = new Client();
let fileShare = new FileShare(client);
let server = new Server().listen(8080);

server.get('/share/:fileId', function (request, response) {
    if (!fs.existsSync('shared_content')) {
        fs.mkdirSync('shared_content');
    }
    const filePath = path.join('shared_content', request.params.fileId);
    console.log(`Server: Serving file ${filePath}`);
    response.setHeader('Content-Disposition', `attachment; filename=${request.params.fileId}`);
    fs.createReadStream(`${filePath}`).pipe(response);
});

function downloadCallback(error, response) {
    if (error) {
        console.error(error);
    } else {
        console.log('Client: Successful download');
    }
}

fileShare.downloadFile('http://localhost:8080/share/download_test_file.txt', downloadCallback);
fileShare.downloadFile('http://localhost:8080/share/download_test_file.txt', {
    "downloadPath": "custom_download_path"
}, downloadCallback);
