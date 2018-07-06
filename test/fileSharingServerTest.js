require('../../../engine/core').enableTesting();
const CrlServer = require('../CrlServer');
const Client = require('../libs/http-wrapper').Client;
const doubleCheck = $$.requireModule('double-check');
const assert = doubleCheck.assert;
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');


const server = new CrlServer(8080);
const client = new Client();

const apiBaseUrl = 'http://127.0.0.1:8080';


function deleteFolderRecursive(folderPath) {
    if (fs.existsSync(folderPath)) {
        fs.readdirSync(folderPath).forEach(function (file, index) {
            const curPath = path.join(folderPath, file);
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(folderPath);
    }
}

const flow = $$.callflow.create('fileSharingTest', {
    public: {
        channelId: 'string',
        fileId: 'string'
    },
    start: function (filePath, callback) {
        this.finalCallback = callback;
        const serial = this.serial(this.onFinal, 'Execution ended called');
        serial.createChannel(serial.gotChannelId);
        serial.writeFile(filePath, serial.finishedWritingFile);
        serial.checkFilesHashes(filePath, serial.compareHashes);
        serial.downloadFile(serial.finishedDownloadFile);
        serial.checkDownloadedFilesHashes(filePath, serial.compareHashes);
        serial.deleteFileFromServer(serial.checkFileDeleted);
    },
    createChannel: function (callback) {
        client.post(apiBaseUrl + '/channels', function (res) {
            let id = '';
            res.on('data', (chunk) => {
                id += chunk;
            });
            res.on('end', () => {
                assert.equal(res.statusCode, 201, 'Channel creation was not successful');
                callback(id);
            });
        });
    },
    gotChannelId: function (id) {
        this.channelId = id;
    },
    writeFile: function (filePath, callback) {
        client.post(`http://localhost:8080/file/${this.channelId}`, {
            body: fs.createReadStream(filePath),
            headers: {
                'Content-Type': 'application/octet-stream'
            }
        }, function (res) {
            let id = '';
            res.on('data', (chunk) => {
                id += chunk;
            });
            res.on('end', () => {
                assert.equal(res.statusCode, 201, 'Uploading file was not successful');
                callback(id);
            });
        });
    },
    finishedWritingFile: function (id) {
        this.fileId = id;
    },
    checkFilesHashes: function (originalFilePath, callback) {
        const hmac1 = crypto.createHmac('sha256', 'a secret');
        fs.createReadStream(originalFilePath).pipe(hmac1);

        hmac1.on('readable', () => {

            const hmac2 = crypto.createHmac('sha256', 'a secret');
            fs.createReadStream(`./channels/${this.channelId}/${this.fileId}`).pipe(hmac2);

            hmac2.on('readable', () => {
                const hashOriginalFile = hmac1.read();
                const hashUploadedFile = hmac2.read();
                if (hashOriginalFile && hashUploadedFile) {
                    callback(hashOriginalFile.toString('hex'), hashUploadedFile.toString('hex'));
                }

            });
        })
    },
    compareHashes: function (hash1, hash2) {
        assert.equal(hash1, hash2, 'Files are not equal');
    },
    downloadFile: function (callback) {
        client.get(`http://localhost:8080/file/${this.channelId}/${this.fileId}`, (res) => {
            const downloadsFolderPath = 'downloads';
            deleteFolderRecursive(downloadsFolderPath);
            fs.mkdirSync(downloadsFolderPath);
            const newFile = fs.createWriteStream(`${downloadsFolderPath}/${this.fileId}`);

            const writeStream = res.pipe(newFile);
            writeStream.on('finish', () => {
                callback();
            });

            writeStream.on('error', () => {
                assert.true(false, 'Download failed');
            });
        });
    },
    finishedDownloadFile: function () {
    },
    checkDownloadedFilesHashes: function (originalFilePath, callback) {
        const hmac1 = crypto.createHmac('sha256', 'a secret');
        fs.createReadStream(originalFilePath).pipe(hmac1);

        hmac1.on('readable', () => {

            const hmac2 = crypto.createHmac('sha256', 'a secret');
            fs.createReadStream(`./downloads/${this.fileId}`).pipe(hmac2);

            hmac2.on('readable', () => {
                const hashOriginalFile = hmac1.read();
                const hashUploadedFile = hmac2.read();
                if (hashOriginalFile && hashUploadedFile) {
                    callback(hashOriginalFile.toString('hex'), hashUploadedFile.toString('hex'));
                }

            });
        })
    },
    deleteFileFromServer: function (callback) {
        client.delete(`http://localhost:8080/file/${this.channelId}/${this.fileId}`, (res) => {
            assert.equal(res.statusCode, 200, `The file doesn't exists on the server`);
            callback();
        });
    },
    checkFileDeleted: function () {
        assert.equal(fs.existsSync(`./channels/${this.channelId}/${this.fileId}`), false, 'The file was not deleted');
    },
    onFinal: function (err, res) {
        deleteFolderRecursive('./channels');
        deleteFolderRecursive('./downloads');
        server.close(() => {
            this.finalCallback();
        });
    }
});


assert.callback("FileSharingServer test", function (callback) {
    flow.start('test_image.jpeg', callback);
}, 1500);
