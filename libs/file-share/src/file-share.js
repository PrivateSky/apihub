const Client = require('../../http-wrapper').Client;
const fs = require('fs');
const path = require('path');

function FileShare(client) {
    this.client = client || new Client();

    this.uploadFile = function (uploadDestination, filePath, callback) {
        const fileName = path.basename(filePath);
        const uploadUrl = uploadDestination + '/' + fileName;
        let uploadFileStream = fs.createReadStream(filePath);
        const config = {
            body: uploadFileStream,
            headers: {
                'Content-Type': 'application/octet-stream'
            }
        };

        this.client.post(uploadUrl, config, function (response) {
            if (response.statusCode !== 200) {
                callback(response.statusMessage);
            } else {
                callback(undefined, response);
            }
        });
    };

    this.downloadFile = function (fileUrl, options, callback) {
        if (arguments.length === 2) {
            callback = options;
            options = {};
        }
        this.client.get(fileUrl, function (response) {
            if (response.statusCode !== 200) {
                callback(response.statusMessage);
            } else {
                const downloadDirectory = options.downloadPath || "downloaded_content";
                if (!fs.existsSync(downloadDirectory)) {
                    fs.mkdirSync(downloadDirectory);
                }
                const fileName = getResourceNameFrom(fileUrl);
                const filePath = path.join(downloadDirectory, fileName);
                let downloadedContentStream = fs.createWriteStream(filePath);
                response.pipe(downloadedContentStream);
                callback(undefined, response);
            }
        });
    };

    this.deleteFile = function (fileUrl, callback) {
        this.client.delete(fileUrl, function (response) {
            if (response.statusCode !== 200) {
                callback(response.statusMessage);
            } else {
                callback(undefined, response);
            }
        });
    };

    this.getResourceNameFrom = getResourceNameFrom;

    function getResourceNameFrom(url) {
        const lastSlashIndex = url.lastIndexOf('/');
        const resourceName = url.substr(lastSlashIndex + 1);
        return resourceName;
    }
}

module.exports = FileShare;
