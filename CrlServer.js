require('../../engine/core');
const Server = require('./libs/http-wrapper/src/index').Server;
const httpUtils = require('./libs/http-wrapper/src/index').httpUtils;
const folderMQ = require('soundpubsub').folderMQ;
const path = require('path');
const fs = require('fs');


function CrlServer(listeningPort, rootFolder) {
    const port = listeningPort || 8080;
    const server = new Server().listen(port);
    console.log("Listening on port:", port);
    const baseChannelsFolder = path.resolve(path.join(rootFolder || "", "channels"));
    const cachedFolderMQ = new CachedFolderMQ();

    function ensureFolder(folderPath){
        const os = require("os");
        const child_process = require('child_process');
        if (!fs.existsSync(folderPath)) {
            var isWin = (os.platform() === 'win32');
            var cmd = isWin ? "mkdir " : "mkdir -p ";
            child_process.execSync(cmd + folderPath);
            console.log("Folder created", folderPath);
        }
    }

    ensureFolder(baseChannelsFolder);
    console.log("Using as root folder", baseChannelsFolder);

    this.close = function (callback) {
        server.close(callback);
    };

    server.use('/channels/*', httpUtils.setDataHandlerMiddleware);

    server.post('/channels', function (_, response) {
        $$.uidGenerator.safe_uuid((err, channelId) => {
            if (err) {
                response.statusCode = 500;
                response.end();
                return;
            }

            const channelPath = path.join(baseChannelsFolder, channelId);
        cachedFolderMQ.getInstance(channelPath, (err, folder) => {
            if (err) {
                response.statusCode = 500;
                response.end();
                return;
            }

            response.statusCode = 201;
        response.end(channelId);
    });
    });
    });

    server.post('/channels/:uid', function (request, response) {
        $$.uidGenerator.safe_uuid((err, messageId) => {
            if (err) {
                response.statusCode = 500;
                response.end();
                return;
            }

            const channelPath = path.join(baseChannelsFolder, request.params.uid);

        const folderMQInstance = cachedFolderMQ.getInstance(channelPath, (err, folderPath) => {
            if (err) {
                response.statusCode = 500;
                response.end();
            }
        });

        if (!folderMQInstance) {
            response.statusCode = 500;
            response.end();
            return;
        }
        const messagePath = path.join(channelPath, messageId);

        folderMQInstance.writeMessage(messagePath, request.body, (err) => {
            if (err) {
                response.statusCode = 500;
                response.end();
                return;
            }

            response.statusCode = 201;
        response.end();
    });
    });
    });

    server.get('/channels/:uid/msg', function (request, response) {
        const channelPath = path.join(baseChannelsFolder, request.params.uid);

        const folderMQInstance = cachedFolderMQ.getInstance(channelPath, (err) => {
            if (err) {
                response.statusCode = 500;
                response.end();
            }
        });

        if (!folderMQInstance) {
            response.statusCode = 500;
            response.end();
            return;
        }

        let gotAnswer = false;
        const shouldWaitForMore = () => !gotAnswer;

        folderMQInstance.registerConsumer((messageContent, messageId) => {
            gotAnswer = true;
        response.end(JSON.stringify({id: messageId, content: messageContent}));
    }, () => {gotAnswer = true;}, false, shouldWaitForMore);

    });

    server.delete('/channels/:uid/msg/:messageFileId', function (request, response) {

        const channelPath = path.join(baseChannelsFolder, request.params.uid);

        const folderMQInstance = cachedFolderMQ.getInstance(channelPath, (err) => {
            if (err) {
                response.statusCode = 500;
                response.end();
            }
        });
        if (!folderMQInstance) {
            response.statusCode = 500;
            response.end();
            return;
        }

        folderMQInstance.unlinkContent(request.params.messageFileId, (err) => {
            if (err) {
                response.statusCode = 500;
                response.end();
                return;
            }

            response.statusCode = 204;
        response.end();
    });

    });

    /* -------- FILE TRANSFER SERVER -------- */

    server.post('/file/:channelId', function (req, res) {
        $$.uidGenerator.safe_uuid((err, fileId) => {
            if (err) {
                res.statusCode = 500;
                res.end();
                return;
            }

            const filePath = path.join(baseChannelsFolder, req.params.channelId, fileId);
        const fileStream = fs.createWriteStream(filePath);


        if (req.headers['content-type'] !== 'application/octet-stream') {
            req.pipe(fileStream);

            fileStream.on('finish', () => {
                res.end(fileId);
            fileStream.close();
        });
        } else {

            req.on('data', (dataChunk) => {
                fileStream.write(dataChunk);
        });

            req.on('end', () => {
                res.statusCode = 201;
            res.end(fileId);
            fileStream.close();
        });

            req.on('error', () => {
                res.statusCode = 500;
            res.end();
            fileStream.close();
        });
        }
    });
    });

    server.get('/file/:channelId/:fileId', function (req, res) {
        const filePath = path.join(baseChannelsFolder, req.params.channelId, req.params.fileId);
        res.setHeader('Content-Type', 'application/octet-stream');
        fs.createReadStream(filePath).pipe(res);
    });

    server.delete('/file/:channelId/:fileId', function (req, res) {
        const filePath = path.join(baseChannelsFolder, req.params.channelId, req.params.fileId);
        fs.unlink(filePath, (err) => {
            if (err) {
                res.statusCode = 404;
                res.end(err);
            }
            res.end();
    });
    });

    server.use(function (req, res) {
        res.statusCode = 404;
        res.end();
    });
}


function CachedFolderMQ() {
    let size = 0;
    const maxSize = 1000;
    let content = {};

    function addInstance(channelPath, instance) {
        if (size > maxSize) {
            cleanup();
        }
        size++;
        content[channelPath] = {
            calls: 0,
            instance: instance
        };
    }

    // TODO: maybe get instance should return via callback
    this.getInstance = function (channelPath, instanceCreationCallback) {
        let instance;

        if (content[channelPath]) {
            content[channelPath].calls += 1;
            instance = content[channelPath].instance;
            instanceCreationCallback(undefined, channelPath);
        } else {
            instance = new folderMQ.getFolderQueue(channelPath, instanceCreationCallback);
            addInstance(channelPath, instance);
        }

        return instance;
    };

    function cleanup() {
        const keys = Object.keys(content);
        let sum = 0;

        let i = keys.length;
        while (i--) {
            sum += content[keys[i]].calls;
        }

        const mean = Math.round(sum / keys.length);

        const newContent = {};
        i = keys.length;

        let newSize = 0;

        while (i--) {
            if (content[keys[i]].calls > mean) {
                ++newSize;
                newContent[keys[i]] = content[keys[i]];
            }
        }

        content = newContent;
        size = newSize;
    }
}


module.exports = CrlServer;
