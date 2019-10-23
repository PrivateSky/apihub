const storageFolder = process.env.vmq_channel_storage || "../tmp";
const maxQueueSize = process.env.vmq_max_queue_size || 100;
const tokenSize = process.env.vmq_token_size || 48;
const tokenHeaderName = process.env.vmq_token_header_name || "tokenHeader";
const signatureHeaderName = process.env.vmq_signature_header_name || "signature";

const channelsFolderName = "channels";
const channelKeyFileName = "channel_key";

const path = require("path");
const fs = require("fs");
const crypto = require('crypto');
const integration = require("zmq_adapter");

const Queue = require("swarmutils").Queue;
const SwarmPacker = require("swarmutils").SwarmPacker;

function ChannelsManager(server){

    const rootFolder = path.join(storageFolder, channelsFolderName);
    fs.mkdirSync(rootFolder, {recursive: true});

    const channelKeys = {};
    const queues = {};
    const subscribers = {};


    process.env.enable_signature_check = true;

    let baseDir = __dirname;

    //if __dirname appears in process.cwd path it means that the code isn't run from browserified version
    //TODO: check for better implementation
    if(process.cwd().indexOf(__dirname) ===-1){
        baseDir = path.join(process.cwd(), __dirname);
    }

    const zeromqNode = require("./zeromqintegration/pingpongFork").fork(path.join(baseDir,"zeromqintegration","bin","zeromqProxy.js"));

    const forwarder = integration.getForwarderInstance(process.env.vmq_zeromq_forward_address);

    function generateToken(){
        let buffer = crypto.randomBytes(tokenSize);
        return buffer.toString('hex');
    }

    function createChannel(name, publicKey, callback){
        let channelFolder = path.join(rootFolder, name);
        let keyFile = path.join(channelFolder, channelKeyFileName);
        let token = generateToken();

        if(typeof channelKeys[name] !== "undefined" || fs.existsSync(channelFolder)){
            return callback(new Error("channel exists!"));
        }

        fs.mkdirSync(channelFolder);

        if(fs.existsSync(keyFile)){
            return callback(new Error("channel has owner set!"));
        }

        const config = JSON.stringify({publicKey, token});
        fs.writeFile(keyFile, config, (err, res)=>{
            if(!err){
                channelKeys[name] = config;
            }
            return callback(err, !err ? token : undefined);
        });
    }

    function retriveChannelDetails(channelName, callback){
        if(typeof channelKeys[channelName] !== "undefined"){
            return callback(null, channelKeys[channelName]);
        }else{
            fs.readFile(path.join(rootFolder, channelName, channelKeyFileName), (err, res)=>{
                if(res){
                    channelKeys[channelName] = JSON.parse(res);
                }
                callback(err, channelKeys[channelName]);
            });
        }
    }

    function forwardChannel(channelName, forward, callback){
        let channelKeyFile = path.join(rootFolder, channelName, channelKeyFileName);
        fs.readFile(channelKeyFile, (err, content)=>{
            let config;
            try{
                config = JSON.parse(content);
            }catch(e){
                return callback(e);
            }

            if(typeof config !== "undefined"){
                config.forward = forward;
                fs.writeFile(channelKeyFile, JSON.stringify(config), (err, ...args)=>{
                    if(!err){
                        channelKeys[channelName] = config;
                    }
                    callback(err, ...args);
                });
            }
        });
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

    function createChannelHandler(req, res){
        const channelName = req.params.channelName;

        readBody(req, (err, message)=>{
            if(err){
                return sendStatus(res, 400);
            }

            const publicKey = message;

            if(typeof channelName !== "string" || typeof publicKey !== "string"){
                return sendStatus(res, 400);
            }

            let handler = getBasicReturnHandler(res);

            createChannel(channelName, publicKey, (err, token)=>{
                if(!err){
                    res.setHeader(tokenHeaderName, token);
                }
                handler(err, res);
            });
        });
    }

    function sendStatus(res, reasonCode){
        res.statusCode = reasonCode;
        res.end();
    }

    function getBasicReturnHandler(res){
        return function(err, result){
            if(err){
                return sendStatus(res, 500);
            }

            return sendStatus(res, 200);
        }
    }

    function enableForwarderHandler(req, res){

        readBody(req, (err, message)=>{
            const {enable} = message;
            const channelName = req.params.channelName;
            const signature = req.headers[signatureHeaderName];

            if(typeof channelName !== "string" || typeof signature !== "string"){
                return sendStatus(res, 400);
            }

            retriveChannelDetails(channelName, (err, details)=>{
                if(err){
                    return sendStatus(res, 500);
                }else{
                    //todo: check signature against key [details.publickey]

                    if(typeof enable === "undefined" || enable){
                        forwardChannel(channelName, true, getBasicReturnHandler(res));
                    }else{
                        forwardChannel(channelName, null, getBasicReturnHandler(res));
                    }
                }
            });
        });
    }

    function getQueue(name){
        if(typeof queues[name] === "undefined"){
            queues[name] = new Queue();
        }

        return queues[name];
    }

    function checkIfChannelExist(channelName, callback){
        retriveChannelDetails(channelName, (err, details)=>{
            callback(null, err ? false : true);
        });
    }

    function writeMessage(subscribers, message){
        let dispatched = false;
        try {
            while(subscribers.length>0){
                subscriber = subscribers.pop();
                if(!dispatched){
                    deliverMessage(subscriber, message);
                    dispatched = true;
                }else{
                    sendStatus(subscriber, 403);
                }
            }
        }catch(err) {
            //... some subscribers could have a timeout connection
            if(subscribers.length>0){
                deliverMessage(subscribers, message);
            }
        }

        return dispatched;
    }

    function readSendMessageBody(req, callback){
        const contentType = req.headers['content-type'];

        if (contentType === 'application/octet-stream') {
            const contentLength = Number.parseInt(req.headers['content-length'], 10);

            if(Number.isNaN(contentLength)){
                return callback(new Error("Wrong content length header received!"));
            }

            streamToBuffer(req, contentLength, (err, bodyAsBuffer) => {
                if(err) {
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

            stream.on('data', function(chunk){
                const chunkSize = chunk.length;
                const nextOffset = chunkSize + currentOffset;

                if (currentOffset > bufferSize - 1) {
                    stream.close();
                    return callback(new Error('Stream is bigger than reported size'));
                }

                write2Buffer(buffer, chunk, currentOffset);
                currentOffset = nextOffset;

            });
            stream.on('end', function(){
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

    function sendMessageHandler(req, res){
        let channelName = req.params.channelName;

        checkIfChannelExist(channelName, (err, exists)=>{
            if(!exists){
                return sendStatus(res, 403);
            }else{
                retriveChannelDetails(channelName, (err, details)=>{
                    //we choose to read the body of request only after we know that we recognize the destination channel
                    readSendMessageBody(req, (err, message)=>{
                        if(err){
                            console.log(err);
                            return sendStatus(res, 403);
                        }

                        //TODO: to all checks based on message header

                        if(details.forward){
                            //console.log("Forwarding message <", message, "> on channel", channelName);
                            forwarder.send(channelName, message);
                        }else{
                            let queue = getQueue(channelName);
                            let subscribers = getSubscribersList(channelName);
                            let dispatched = false;
                            if(queue.isEmpty()){
                                dispatched = writeMessage(subscribers, message);
                            }
                            if(!dispatched) {
                                if(queue.length < maxQueueSize){
                                    queue.push(message);
                                }else{
                                    //queue is full
                                    return sendStatus(res, 429);
                                }

                                /*
                                if(subscribers.length>0){
                                    //... if we have somebody waiting for a message and the queue is not empty means that something bad
                                    //happened and maybe we should try to dispatch first message from queue
                                }
                                */

                            }
                        }
                        return sendStatus(res, 200);
                    });
                })
            }
        });
    }

    function getSubscribersList(channelName){
        if(typeof subscribers[channelName] === "undefined"){
            subscribers[channelName] = [];
        }

        return subscribers[channelName];
    }

    function deliverMessage(res, message){
        if(Buffer.isBuffer(message)) {
            res.setHeader('content-type', 'application/octet-stream');
        }

        if(typeof message.length !== "undefined"){
            res.setHeader('content-length', message.length);
        }

        res.write(message);
        sendStatus(res, 200);
    }

    function receiveMessageHandler(req, res){
        let channelName = req.params.channelName;
        checkIfChannelExist(channelName, (err, exists)=>{
            if(!exists){
                return sendStatus(res, 403);
            }else{
                retriveChannelDetails(channelName, (err, details)=>{
                    if(err){
                        return sendStatus(res, 500);
                    }
                    //TODO: check signature agains details.publickey


                    if(details.forward){
                        //if channel is forward it does not make sense
                        return sendStatus(res, 409);
                    }

                    let queue = getQueue(channelName);
                    let message = queue.pop();

                    if(!message){
                        getSubscribersList(channelName).push(res);
                    }else{
                        deliverMessage(res, message);
                    }
                });
            }
        });
    }

    server.put("/create-channel/:channelName", createChannelHandler);
    server.post("/forward-zeromq/:channelName", enableForwarderHandler);
    server.post("/send-message/:channelName", sendMessageHandler);
    server.get("/receive-message/:channelName", receiveMessageHandler);
}

module.exports = ChannelsManager;