require('../../../engine/core');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Client = require('../libs/http-wrapper').Client;
const FileShare = require('../libs/file-share');
const CrlServer = require('../CrlServer');
const cleanUp = require('./testCleanUp');

// Upload Node
let uploadNode = new CrlServer();
let uploadedFileHashes = {};

function getSharableResourceUrl(request, resourceName) {
    const resourceUrl = '/share/' + resourceName;
    return request.headers.host + resourceUrl;
}

function hashFile(filePath, callback) {
    const hash = crypto.createHash('sha256');
    const readStream = fs.createReadStream(filePath);

    readStream.on('data', function (data) {
        hash.update(data);
    });
    readStream.on('end', function () {
        callback(undefined, hash.digest('hex'));
    });
    readStream.on('error', function (error) {
        callback(error);
    });
}

uploadNode.server.post('/share/upload/:fileName', function (request, response) {
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
            let uploadedFileStream = fs.createWriteStream(filePath);
            request.pipe(uploadedFileStream);
            uploadedFileStream.on('finish', function () {
                const sharableResourceUrl = getSharableResourceUrl(request, fileName);
                hashFile(filePath, function (error, hash) {
                    if (error) {
                        console.error(error);
                    } else {
                        uploadedFileHashes[sharableResourceUrl] = hash;
                        response.end(sharableResourceUrl);
                    }
                });
            });
        }
    });
});

uploadNode.server.get('/share/:fileId', function (request, response) {
    const filePath = path.join('shared_content', request.params.fileId);
    response.setHeader('Content-Disposition', `attachment; filename=${request.params.fileId}`);
    fs.createReadStream(`${filePath}`).pipe(response);
});

uploadNode.server.delete('/share/:resourceUid', function (request, response) {
    const resourcePath = path.join('shared_content', request.params.resourceUid);
    fs.unlink(resourcePath, function (error) {
        if (error) {
            console.error(error);
            response.statusCode = 404;
        }
        response.end();
    });
});
// End of Upload Node

// Uploader Node <=> The node that uploads files
let uploaderClient = new Client();
let uploaderNode = new CrlServer(1234);
let fileShareForUpload = new FileShare(uploaderClient);
let uploadedResourcesLocation = [];

function uploadCallback(error, response, filePath) {
    if (error) {
        console.error(error);
    } else {
        uploaderNode.getBodyFrom(response, function (error, sharableResourceLink) {
            if (error) {
                console.error(error)
            } else {
                hashFile(filePath, function (error, hash) {
                    if (hash !== uploadedFileHashes[sharableResourceLink]) {
                        console.log(`Failed to upload correctly resource ${filePath}. Hash ${hash} instead of ${uploadedFileHashes[sharableResourceLink]}`);
                    } else {
                        console.log(`Successful upload. Download Link: ${sharableResourceLink}`);
                        uploadedResourcesLocation.push(sharableResourceLink);
                    }
                });
            }
        });
    }
}

fileShareForUpload.uploadFile('http://localhost:8080/share/upload', './test_image.jpeg', function (error, response) {
    uploadCallback(error, response, './test_image.jpeg')
});
fileShareForUpload.uploadFile('http://localhost:8080/share/upload', './test_file.txt', function (error, response) {
    uploadCallback(error, response, './test_file.txt')
});

function notifyDownloader(channelId) {
    uploadedResourcesLocation.forEach((resourceLink) => {
        const requestConfig = {
            body: resourceLink
        };
        uploaderClient.post(`http://localhost:2018/channel/${channelId}`, requestConfig, function (response) {
            if (response.statusCode !== 200) {
                console.error(`Failed to post resource link ${resourceLink} in channel: ${response.statusMessage}`);
            } else {
                console.log(`Successful posted resource link ${resourceLink}`);
            }
        });
    });
}

// End of Uploader Node

// Downloader Node <=> The node that downloads files
// Wait for 1 second to make sure that the uploadClient is running
setTimeout(() => {
    let downloaderClient = new Client();
    let downloaderNode = new CrlServer(2018);
    let fileShareForDownload = new FileShare(downloaderClient);

    const testConfig = {
        'channelHost': 'http://localhost:1234/channel'
    };

    function handleResourceDownload(resourceUrl) {
        if (!resourceUrl.startsWith('http')) {
            resourceUrl = 'http://' + resourceUrl;
        }
        console.log(`MESSAGE CONTAINS RESOURCE URL: ${resourceUrl}`);
        fileShareForDownload.downloadFile(resourceUrl, function (error, response) {
            if (error) {
                console.error(error);
            } else {
                fileShareForDownload.deleteFile(resourceUrl, function (error, response) {
                    if (error) {
                        console.error(error)
                    } else {
                        console.log('Successful deleted resource');
                    }
                    cleanUp('channels');
                    cleanUp('downloaded_content');
                    cleanUp('shared_content');
                });
                const resourceName = fileShareForDownload.getResourceNameFrom(resourceUrl);
                hashFile(`downloaded_content/${resourceName}`, function (error, hash) {
                    resourceUrl = resourceUrl.substr(7);
                    if (hash !== uploadedFileHashes[resourceUrl]) {
                        console.log(`Failed to download resource from ${resourceUrl}`)
                    } else {
                        console.log(`Success download from ${resourceUrl}`);
                    }
                });
            }
        });
    }

    function handleNormalMessage(message) {
        console.log(`NORMAL MESSAGE: ${message}`);
    }

    function deleteReadChannelMessage(messageId, channelUid) {
        downloaderClient.delete(`${testConfig.channelHost}/${channelUid}/msg/${messageId}`, function (response) {
            if (response.statusCode !== 200) {
                console.error(response.statusMessage);
            } else {
                console.log(`Successful deleted message from channel ${channelUid}`);
            }
        });
    }

    function handleMessage(response, channelUid) {
        if (response.statusCode !== 200) {
            console.error(`Failed to read message: ${response.statusMessage}`);
        } else {
            const urlRegex = /((https?:\/\/)?[^\s]+)/g;
            downloaderNode.getBodyFrom(response, function (error, body) {
                const bodyContent = JSON.parse(body);
                if (bodyContent.content.match(urlRegex)) {
                    handleResourceDownload(bodyContent.content);
                } else {
                    handleNormalMessage(body);
                }
                deleteReadChannelMessage(bodyContent.id, channelUid);
            });
        }
    }

    function waitForMessages(response) {
        if (response.statusCode !== 200) {
            console.error(`Failed to create channel: ${response.statusMessage}`);
        } else {
            downloaderNode.getBodyFrom(response, function (error, channelUid) {
                notifyDownloader(channelUid);
                const messageChannelUrl = testConfig.channelHost + '/' + channelUid + '/msg';
                console.log(`Listening for new messages on: ${messageChannelUrl}`);
                downloaderClient.get(messageChannelUrl, function (response) {
                    handleMessage(response, channelUid);
                });
            });
        }
    }

    downloaderClient.post(testConfig.channelHost, {}, waitForMessages);
}, 1000);
// End of Downloader Node
