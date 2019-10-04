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

    let messagesSent = [];
    let messagesReceived = [];
    let howMany = 300;

    function startSending(){
        function oneByOne(){
            let message = messagesSent.length;
            messagesSent.push(message);
            sendMessage(channelName, message.toString(), (res)=>{
                assert.equal(res.statusCode, 200);
                //..
            });
        }

        let timer = setInterval(()=>{
            if(messagesSent.length>howMany){
                return clearInterval(timer);
            }
            oneByOne();
        }, 10);

        /*for(let i=0; i<howMany; i++){
            oneByOne();
        }*/
    }

    function testIfFinish(consumer){
        if(messagesReceived.length === howMany){
            consumer.close();
            finishTest();
        }else{
            console.log(`Received message number ${messagesReceived.length}`);
        }
    }

    function createFakeDomainSubscriber(channelName, message){
        const zmqIntegration = require("../zeromqintegration");

        let catchEvents = (eventType, ...args)=>{
            console.log("Event type caught", eventType, ...args);
            if(eventType === "connect"){
                startSending();
            }
        };

        let consumer = zmqIntegration.createZeromqConsumer("tcp://127.0.0.1:6000", catchEvents);
        consumer.subscribe(channelName, "", (channel, receivedMessage)=>{
            //console.log("Getting my message back", channel.toString(), receivedMessage.toString());
            receivedMessage = Number(receivedMessage.toString());

            console.log(messagesReceived.length, receivedMessage);
            assert.true(messagesReceived.length == receivedMessage);

            messagesReceived.push(receivedMessage);
            testIfFinish(consumer);
        });
    }

    createChannel(channelName, (res)=>{
        assert.equal(res.statusCode, 200);

        let token = res.headers["tokenHeader"];
        assert.notNull(token);

        let message = "message";

        setTimeout(()=>{
            createFakeDomainSubscriber(channelName, message)
        }, 1000);

    });
}

assert.callback("Retrive a message from a zeromq channel that has messages forward enable", (callback)=>{
    doubleCheck.createTestFolder("vmq", (err, folder)=>{
        if(!err){
            process.env.channel_storage = path.join(folder, "tmp");
            console.log(process.env.channel_storage);
            createServer(process.env.channel_storage, (...args)=>{
                mainTest(...args, callback);
            });
        }
    });
}, 5000);