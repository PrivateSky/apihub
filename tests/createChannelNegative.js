const http = require("http");
const path = require("path");
const crypto = require("crypto");

require("../../../psknode/bundles/pskruntime");
require("../../../psknode/bundles/virtualMQ");

const VirtualMQ = require("../index");
const doubleCheck = require('../../double-check');
const assert = doubleCheck.assert;

let port = 8000;
process.env.vmq_zeromq_forward_address = "tcp://127.0.0.1:5010";
process.env.vmq_zeromq_sub_address = "tcp://127.0.0.1:5010";
process.env.vmq_zeromq_pub_address = "tcp://127.0.0.1:5011";

function createServer(folder, callback) {
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

        const req = http.request(options, callback);
        req.write("my-public-key");
        req.end();
    }

    createChannel(channelName, (res)=>{
        assert.equal(res.statusCode, 200);

        let token = res.headers["tokenHeader"];
        assert.notNull(token);

        createChannel(channelName, (res)=>{
            assert.equal(res.statusCode, 500);

            finishTest();
        });

    });
}

assert.callback("Create Channel Test", (callback)=>{
    doubleCheck.createTestFolder("vmq", (err, folder)=>{
        if(!err){
            process.env.vmq_channel_storage = path.join(folder, "tmp");
            createServer(process.env.vmq_channel_storage, (...args)=>{
                mainTest(...args, callback);
            });
        }
    });
}, 3000);