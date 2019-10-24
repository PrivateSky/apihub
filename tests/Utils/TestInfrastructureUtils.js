const http = require("http");
const path = require("path");
const crypto = require("crypto");

require("../../../../psknode/bundles/pskruntime");
require("../../../../psknode/bundles/virtualMQ");

const VirtualMQ = require("../../index");
const swarmUtils = require("swarmutils");
const SwarmPacker = swarmUtils.SwarmPacker;
const doubleCheck = require('../../../double-check');
const assert = doubleCheck.assert;

function getPort(){
    return Math.floor((Math.random() * 55000) + 2000);
}

let port = getPort();
let pubP = getPort();
let subP = getPort();

process.env.vmq_zeromq_forward_address = `tcp://127.0.0.1:${pubP}`;
process.env.vmq_zeromq_sub_address = `tcp://127.0.0.1:${subP}`;
process.env.vmq_zeromq_pub_address = `tcp://127.0.0.1:${pubP}`;

function createServer(folder, callback) {
    var server = VirtualMQ.createVirtualMQ(port, folder, undefined, (err, res) => {
        if (err) {
            console.log("Failed to create VirtualMQ server on port ", port, "Trying again...");
                port = getPort();
                createServer(folder, callback);
        } else {
            console.log("Server ready and available on port ", port);
            callback(server, port);
        }
    });
}

function RequestFactory(hostname, port){
    function createChannel(channelName, publicKey, callback){
        const options = {
            hostname: hostname,
            port: port,
            path: `/create-channel/${channelName}`,
            method: "PUT"
        };

        const req = http.request(options, callback);
        req.write(publicKey);
        req.end();
    }

    function createForwardChannel(channelName, publicKey, callback){
        const options = {
            hostname: hostname,
            port: port,
            path: `/create-channel/${channelName}`,
            method: "PUT"
        };

        const req = http.request(options, (res)=>{
            enableForward(channelName, "justASignature", callback);
        });
        req.write(publicKey);
        req.end();
    }

    function enableForward(channelName, signature, callback){
        const options = {
            hostname: hostname,
            port: port,
            path: `/forward-zeromq/${channelName}`,
            method: "POST"
        };

        const req = http.request(options, callback);
        req.setHeader("signature", signature);
        req.end();
    }

    function sendMessage(channelName, message, signature, callback){
        const options = {
            hostname: hostname,
            port: port,
            path: `/send-message/${channelName}`,
            method: "POST"
        };

        const req = http.request(options, callback);
        req.setHeader("signature", signature);

        let pack = SwarmPacker.pack(message);

        req.setHeader("content-length", pack.byteLength);
        req.setHeader("content-type", 'application/octet-stream');
        req.write(Buffer.from(pack));
        req.end();
    }

    function receiveMessage(channelName, signature, callback){
        const options = {
            hostname: hostname,
            port: port,
            path: `/receive-message/${channelName}`,
            method: "GET"
        };

        const req = http.request(options, function(res){
            const utils = require("../../utils");
            utils.readMessageBufferFromStream(res, function(err, message){

                callback(err, res, (message && Buffer.isBuffer(message)) ? SwarmPacker.unpack(message.buffer) : message);
            });
        });
        req.setHeader("signature", signature);
        req.end();
    }

    function receiveMessageFromZMQ(channelName, signature, readyCallback, receivedCallback){
        const zmqIntegration = require("zmq_adapter");

        let catchEvents = (eventType, ...args)=>{
            //console.log("Event type caught", eventType, ...args);
            if(eventType === "connect"){
                //connected so all good
                readyCallback();
            }
        };

        let consumer = zmqIntegration.createZeromqConsumer(process.env.vmq_zeromq_sub_address, catchEvents);
        consumer.subscribe(channelName, signature, (channel, receivedMessage)=>{
            let unpackedMessage = SwarmPacker.unpack(receivedMessage.buffer);
            //console.log("Getting my message back", channel.toString(), unpackedMessage);
            receivedCallback(JSON.parse(channel.toString()).channelName, unpackedMessage);
        });
    }

    function generateMessage(swarmName, swarmPhase, args, targetAgent, returnAddress){
        return {
            meta:{
                swarmId: swarmUtils.generateUid(32).toString("hex"),
                requestId: swarmUtils.generateUid(32).toString("hex"),
                swarmTypeName: swarmName || "testSwarmType",
                phaseName: swarmPhase || "swarmPhaseName",
                args: args || [],
                command: "executeSwarmPhase",
                target: targetAgent || "agentURL",
                homeSecurityContext: returnAddress || "no_home_no_return"
            }};
    }

    function getPort(){
        return port;
    }

    //targeted virtualmq apis
    this.createChannel = createChannel;
    this.createForwardChannel = createForwardChannel;
    this.enableForward = enableForward;
    this.sendMessage = sendMessage;
    this.receiveMessage = receiveMessage;
    this.receiveMessageFromZMQ = receiveMessageFromZMQ;

    //utils----
    this.getPort = getPort;
    this.generateMessage = generateMessage;

}

module.exports.createInfrastructureTest = function(name, time2Expire, hostname, callback){
    assert.callback(name, (finish)=>{
        doubleCheck.createTestFolder("vmq", (err, folder)=>{
            if(!err){
                process.env.vmq_channel_storage = path.join(folder, "tmp");
                createServer(process.env.vmq_channel_storage, (server, port, ...args)=>{
                    let apis = new RequestFactory(hostname, port);
                    callback(null, apis, finish);
                });
            }else{
                callback(err);
            }
        });
    }, time2Expire || 10000);
};

