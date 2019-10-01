const http = require("http");
const path = require("path");
const crypto = require("crypto");
require("../../../psknode/bundles/pskruntime");
require("../../../psknode/bundles/virtualMQ");
const VirtualMQ = require("../index");
const doubleCheck = require('../../double-check');
const assert = doubleCheck.assert;

function createServer(folder, callback) {
    let port = 8000;
    var server = VirtualMQ.createVirtualMQ(port, folder, undefined, (err, res) => {
        if (err) {
            console.log("Failed to create VirtualMQ server on port ", port, "Trying again...");
            if (port > 80 && port < 50000) {
                port++;
                createServer(folder, callback);
            } else {
                console.log("There is no available port to start VirtualMQ instance need it for test!");
            }
        } else {
            console.log("Server ready and available on port ", port);
            callback(server, port);
        }
    });
}

function mainTest(server, port, finishTest){
    channelName = crypto.randomBytes(24).toString('hex');

    function createChannel(channelName, callback){
        const options = {
            hostname: "127.0.0.1",
            port: port,
            path: `/create-channel/${channelName}`,
            method: "PUT"
        };

        const req = http.request(options, (res)=>{
            enableForward(channelName, callback);
        });
        req.write("my-public-key");
        req.end();
    }

    function enableForward(channelName, callback){
        const options = {
            hostname: "127.0.0.1",
            port: port,
            path: `/forward-zeromq/${channelName}`,
            method: "POST"
        };

        const req = http.request(options, callback);
        req.setHeader("signature", "justasimplestringfornow");
        req.end();
    }

    function sendMessage(channelName, message, callback){
        const options = {
            hostname: "127.0.0.1",
            port: port,
            path: `/send-message/${channelName}`,
            method: "POST"
        };

        const req = http.request(options, callback);
        req.setHeader("signature", "justasimplestringfornow");
        req.write(message);
        req.end();
    }

    function receiveMessage(channelName, callback){
        const options = {
            hostname: "127.0.0.1",
            port: port,
            path: `/receive-message/${channelName}`,
            method: "GET"
        };

        const req = http.request(options, callback);
        req.setHeader("signature", "justasimplestringfornow");
        req.end();
    }

    function readBody(req, callback){
        let data = "";
        req.on("data", (messagePart)=>{
            data += messagePart;
        });

        req.on("end", ()=>{
            callback(null, data);
        });

        req.on("error", (err)=>{
            callback(err);
        });
    }

    createChannel(channelName, (res)=>{
        assert.equal(res.statusCode, 200);

        let token = res.headers["tokenHeader"];
        assert.notNull(token);

        let message = "message";

        const zmq = require("../../../node_modules/zeromq");

        let socket = zmq.socket("sub");
console.log("connecting to zeromq... ");
        socket.connect("tcp://127.0.0.1:6001", (err)=>{
            assert.isNull(err);
            socket.subscribe(channelName);
            console.log("Everything is ready... sending the message");
            sendMessage(channelName, message, (res)=>{
                assert.equal(res.statusCode, 200);
                //..
            });
        });

        socket.on("message", (receivedMessage)=>{
            assert.equal(message, receivedMessage);
            socket.close();
            finishTest();
        });

    });
}

assert.callback("Retrive a message from a zeromq channel that has messages forward enable", (callback)=>{
    doubleCheck.createTestFolder("vmq", (err, folder)=>{
        if(!err){
            process.env.channel_storage = path.join(folder, "tmp");
            createServer(folder, (...args)=>{
                mainTest(...args, callback);
            });
        }
    });
}, 3000);