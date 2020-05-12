function readMessageBufferFromHTTPStream(reqORres, callback) {
    const contentType = reqORres.headers['content-type'];

    if (contentType === 'application/octet-stream') {
        const contentLength = Number.parseInt(reqORres.headers['content-length'], 10);

        if (Number.isNaN(contentLength)) {
            return callback(new Error("Wrong content length header received!"));
        }

        streamToBuffer(reqORres, contentLength, (err, bodyAsBuffer) => {
            if (err) {
                return callback(err);
            }
            callback(undefined, bodyAsBuffer);
        });
    } else {
        callback(new Error("Wrong message format received!"));
    }

    function streamToBuffer(stream, bufferSize, callback) {
        const buffer = Buffer.alloc(bufferSize);
        let currentOffset = 0;

        stream.on('data', function (chunk) {
            const chunkSize = chunk.length;
            const nextOffset = chunkSize + currentOffset;

            if (currentOffset > bufferSize - 1) {
                stream.close();
                return callback(new Error('Stream is bigger than reported size'));
            }

            write2Buffer(buffer, chunk, currentOffset);
            currentOffset = nextOffset;

        });
        stream.on('end', function () {
            callback(undefined, buffer);
        });
        stream.on('error', callback);
    }

    function write2Buffer(buffer, dataToAppend, offset) {
        const dataSize = dataToAppend.length;

        for (let i = 0; i < dataSize; i++) {
            buffer[offset++] = dataToAppend[i];
        }
    }
}

let serverConf;
const ServerConfig = require("./ServerConfig");

function getServerConfig() {
    if (typeof serverConf === "undefined") {
        const fs = require("fs");
        const path = require("path");
        try {
            serverConf = fs.readFileSync(path.join(process.env.PSK_ROOT_INSTALATION_FOLDER, "conf", "server.json"));
            serverConf = JSON.parse(serverConf.toString());
        } catch (e) {
            serverConf = undefined;
        }
    }

    return new ServerConfig(serverConf);
}

module.exports = {
    readMessageBufferFromHTTPStream,
    getServerConfig
};