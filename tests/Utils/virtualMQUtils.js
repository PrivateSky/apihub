require("../../../psknode/bundles/pskruntime");
require("../../../psknode/bundles/virtualMQ");
require("../../../psknode/bundles/psknode");
const http = require("http");

const VirtualMQ = require('virtualmq');
const CHANNEL_NAME = $$.Buffer.from('mychannel').toString('base64');
const path = require("swarmutils").path;
const fs = require('fs');
let port = 8089;
let serverURL = `http://localhost:${port}/${CHANNEL_NAME}`;


deleteFolder = function (folder) {
    const removeDirSync = require("swarmutils").removeDirSync;
    if (fs.existsSync(folder)) {
        fs.readdirSync(folder).forEach(function (file, index) {
            var curPath = path.join(folder, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolder(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        removeDirSync(folder);
    }
};
module.exports.serverUrl = serverURL;
module.exports.initVirtualMQ = function () {
    this.createTestFolder();
};

module.exports.createTestFolder = function () {

    try {
        folder = fs.mkdtempSync("getMsg");
    } catch (err) {
        console.log("Failed to create tmp directory");
        return;
    }

};
module.exports.createServer = function (callback) {
    var server = VirtualMQ.createPskWebServer(port, folder, undefined, (err, res) => {
        if (err) {
            console.log("Failed to create VirtualMQ server on port ", port);
            console.log("Trying again...");
            if (port > 1024 && port < 50000) {
                port++;
                createServer(callback);
            } else {
                console.log("There is no available port to start VirtualMQ instance need it for test!");
            }
        } else {
            console.log("Server ready and available on port ", port);
            serverURL = `http://localhost:${port}/${CHANNEL_NAME}`;
            callback(server);
        }
    });
};

module.exports.getRequestOptions = function (requestType, urlParams) {
    let path = urlParams ? '/' + CHANNEL_NAME + urlParams : '/' + CHANNEL_NAME;
    let headers = {'Content-Type': 'application/json;charset=UTF-8'};
    if (requestType && requestType == 'DELETE') {
        headers ['Content-Length'] = $$.Buffer.byteLength(urlParams.slice(1));
    }
    return {
        host: '127.0.0.1',
        port: port,
        path: path,
        method: requestType || 'POST',
        headers: headers
    }
};

module.exports.createSwarmMessage = function (msg) {
    return JSON.stringify({
        meta: {
            swarmId: 'AAAA',
            TEXT:msg
        }
    });
};

module.exports.deleteFolder = deleteFolder;


/*
HTTP Request with args:
 - msg: string message to POST/PUT
 - responseCallback: callback for on end request, default will just display a message
 - requestType : PUT, POST, GET, DELETE (default is POST)
* */
module.exports.httpRequest = function (msg, responseCallback, requestType, options) {
    let opt = options || this.getRequestOptions(requestType);
    var req = http.request(opt, (res) => {
        const statusCode = res.statusCode;
        let error;
        if (statusCode >= 400) {
            error = new Error('Request Failed.\n' +
                `Status Code: ${statusCode}`) + ' requestType ' + requestType;
        }

        if (error) {
            console.log(error);
            res.resume();
            return;
        }

        let rawData = '';
        res.on('data', (chunk) => {
            rawData += chunk;
        });
        let onEndCallback = responseCallback || function (rowData) {
            console.log('posting data', rowData)
        };
        res.on('end', () => {
            onEndCallback(rawData)
        });
    });
    if (opt.method != 'GET') {
        req.write(msg);
    }
    req.on('error', function (e) {
        throw e;
    });
    req.end();
};
module.exports.cleanUp = function (timeout) {
    setTimeout(() => {
        this.deleteFolder(folder);
        process.exit(0);
    }, timeout);
};