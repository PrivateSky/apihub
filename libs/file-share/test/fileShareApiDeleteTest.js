const FileShare = require('../index');
const Server = require('../../http-wrapper').Server;
const Client = require('../../http-wrapper').Client;
const fs = require('fs');
const path = require('path');

let client = new Client();
let fileShare = new FileShare(client);
let server = new Server().listen(8080);

server.delete('/share/:fileId', function (request, response) {
    const filePath = path.join('shared_content', request.params.fileId);
    console.log(`Deleting ${filePath}`);
    fs.unlink(filePath, function (error) {
        if (error) {
            response.statusCode = 404;
            console.error(`Server: Failed to delete ${filePath}`);
        } else {
            console.log(`Server: Successful deleted ${filePath}`);
        }
        response.end();
    });
});

fileShare.deleteFile('http://localhost:8080/share/download_test_file.txt', function (error, response) {
    if (error) {
        console.error(error);
    } else {
        console.log('Client: Successful delete');
    }
});
