const http = require('http');
const {URL} = require('url');
const swarmUtils = require('swarmutils');
const SwarmPacker = swarmUtils.SwarmPacker;
const signatureHeaderName = process.env.vmq_signature_header_name || "x-signature";

function RequestFactory(virtualMQAddress, zeroMQAddress) {
    function createChannel(channelName, publicKey, callback) {
        const options = {
            path: `/create-channel/${channelName}`,
            method: "PUT"
        };

        const req = http.request(virtualMQAddress, options, callback);
        req.write(publicKey);
        req.end();
    }

    function createForwardChannel(channelName, publicKey, callback) {
        const options = {
            path: `/create-channel/${channelName}`,
            method: "PUT"
        };

        const req = http.request(virtualMQAddress, options, (res) => {
            this.enableForward(channelName, "justASignature", callback);
        });
        req.write(publicKey);
        req.end();
    }

    function enableForward(channelName, signature, callback) {
        const options = {
            path: `/forward-zeromq/${channelName}`,
            method: "POST"
        };

        const req = http.request(virtualMQAddress, options, callback);
        req.setHeader(signatureHeaderName, signature);
        req.end();
    }

    function sendMessage(channelName, message, signature, callback) {
        const options = {
            path: `/send-message/${channelName}`,
            method: "POST"
        };

        const req = http.request(virtualMQAddress, options, callback);
        req.setHeader(signatureHeaderName, signature);

        let pack = SwarmPacker.pack(message);

        req.setHeader("content-length", pack.byteLength);
        req.setHeader("content-type", 'application/octet-stream');
        req.write(Buffer.from(pack));
        req.end();
    }

    function receiveMessage(channelName, signature, callback) {
        const options = {
            path: `/receive-message/${channelName}`,
            method: "GET"
        };

        const req = http.request(virtualMQAddress, options, function (res) {
            const utils = require("./utils").streams;
            utils.readMessageBufferFromStream(res, function (err, message) {

                callback(err, res, (message && Buffer.isBuffer(message)) ? SwarmPacker.unpack(message.buffer) : message);
            });
        });

        req.setHeader(signatureHeaderName, signature);
        req.end();
    }

    function receiveMessageFromZMQ(channelName, signature, readyCallback, receivedCallback) {
        const zmqIntegration = require("zmq_adapter");

        let catchEvents = (eventType, ...args) => {
            // console.log("Event type caught", eventType, ...args);
            if (eventType === "connect") {
                //connected so all good
                readyCallback();
            }
        };

        let consumer = zmqIntegration.createZeromqConsumer(zeroMQAddress, catchEvents);
        consumer.subscribe(channelName, signature, (channel, receivedMessage) => {
            receivedCallback(JSON.parse(channel.toString()).channelName, receivedMessage.buffer);
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

    function getPort() {
        try {
            return new URL(virtualMQAddress).port;
        } catch (e) {
          console.error(e);
        }
    }

    // targeted virtualmq apis
    this.createChannel = createChannel;
    this.createForwardChannel = createForwardChannel;
    this.enableForward = enableForward;
    this.sendMessage = sendMessage;
    this.receiveMessage = receiveMessage;
    this.receiveMessageFromZMQ = receiveMessageFromZMQ;

    // utils for testing
    if(!process.env.NODE_ENV || (process.env.NODE_ENV && !process.env.NODE_ENV.startsWith('prod'))) { // if NODE_ENV does not exist or if it exists and is not set to production
        this.getPort = getPort;
        this.generateMessage = generateMessage;
    }
}

module.exports = RequestFactory;