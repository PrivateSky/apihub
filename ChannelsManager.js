const path = require("path");
const fs = require("fs");
const crypto = require('crypto');
const integration = require("zmq_adapter");

const Queue = require("swarmutils").Queue;
const SwarmPacker = require("swarmutils").SwarmPacker;

function ChannelsManager(server){
    const utils = require("./utils");
    const config = utils.getServerConfig();
    const channelKeyFileName = "channel_key";

    const rootFolder = path.join(config.getStorage(), config.getChannelsFolderName());
    fs.mkdirSync(rootFolder, {recursive: true});

    const channelKeys = {};
    const queues = {};
    const subscribers = {};

    let baseDir = __dirname;

    //if __dirname appears in process.cwd path it means that the code isn't run from browserified version
    //TODO: check for better implementation
    if(process.cwd().indexOf(__dirname) ===-1){
        baseDir = path.join(process.cwd(), __dirname);
    }


    let forwarder;
    if(integration.testIfAvailable()){
        forwarder = integration.getForwarderInstance(config.getZeromqForwardAddress());
    }

    function generateToken(){
        let buffer = crypto.randomBytes(config.getTokenSize());
        return buffer.toString('hex');
    }

    function createChannel(name, publicKey, callback){
        let channelFolder = path.join(rootFolder, name);
        let keyFile = path.join(channelFolder, channelKeyFileName);
        let token = generateToken();

        if(typeof channelKeys[name] !== "undefined" || fs.existsSync(channelFolder)){
            let e = new Error("channel exists!");
            e.code = 409;
            return callback(e);
        }

        fs.mkdirSync(channelFolder);

        if(fs.existsSync(keyFile)){
            let e = new Error("channel exists!");
            e.code = 409;
            return callback(e);
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
                    try{
                        channelKeys[channelName] = JSON.parse(res);
                    }catch(e){
                        console.log(e);
                        return callback(e);
                    }
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
            if (typeof channelName !== "string" || channelName.length === 0 ||
                typeof publicKey !== "string" || publicKey.length === 0) {
                return sendStatus(res, 400);
            }

            let handler = getBasicReturnHandler(res);

            createChannel(channelName, publicKey, (err, token)=>{
                if(!err){
                    res.setHeader('Cookie', [`${config.getTokenSize()}=${token}`]);
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
                return sendStatus(res, err.code || 500);
            }

            return sendStatus(res, 200);
        }
    }

    function enableForwarderHandler(req, res){
        if(integration.testIfAvailable() === false){
            return sendStatus(res, 417);
        }
        readBody(req, (err, message)=>{
            const {enable} = message;
            const channelName = req.params.channelName;
            const signature = req.headers[config.getSignatureHeaderName()];

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
                let subscriber = subscribers.pop();
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
                let error = new Error("Wrong content length header received!");
                error.code = 411;
                return callback(error);
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
                            //console.log(err);
                            return sendStatus(res, 403);
                        }

                        let header;
                        try{
                            header = SwarmPacker.unpack(message.buffer);
                        }catch(error){
                            //console.log(error);
                            return sendStatus(res, 400);
                        }

                        //TODO: to all checks based on message header

                        if(integration.testIfAvailable() && details.forward){
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
                                if(queue.length < config.getMaxQueueSize()){
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

    function getCookie(res, cookieName){
        let cookies = res.headers['cookie'];
        if(typeof cookies === "undefined"){
            return undefined;
        }
        if(Array.isArray(cookies)){
            for(let i=0; i<cookies.length; i++){
                let cookie = cookies[i];
                if(cookie.indexOf(cookieName) !== -1){
                    return cookie.substr(cookieName.length+1);
                }
            }
        }else{
            cookieName = cookieName.replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');

            let regex = new RegExp('(?:^|;)\\s?' + cookieName + '=(.*?)(?:;|$)','i');
            let match = cookies.match(regex);

            return match && unescape(match[1]);
        }
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

                    /*let signature = req.headers["signature"];
                    if(typeof signature === "undefined"){
                        return sendStatus(res, 403);
                    }*/

                    // let cookie = getCookie(req, tokenHeaderName);

                    // if(typeof cookie === "undefined" || cookie === null){
                    //     return sendStatus(res, 412);
                    // }

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