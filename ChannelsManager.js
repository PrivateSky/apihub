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

const Queue = require("swarmutils").Queue;

function ChannelsManager(server){

    const rootFolder = path.join(storageFolder, channelsFolderName);
    fs.mkdirSync(rootFolder, {recursive: true});

    const channelKeys = {};
    const queues = {};
    const subscribers = {};

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
                        //TODO: start forward client
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

    server.put("/create-channel/:channelName", function(req, res){
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
    });

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

    server.post("/forward-zeromq/:channelName", function(req, res){

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
    });

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

    server.post("/send-message/:channelName", function(req, res){
        let channelName = req.params.channelName;
        readBody(req, (err, message)=>{
            checkIfChannelExist(channelName, (err, exists)=>{
               if(!exists){
                   return sendStatus(res, 403);
               }else{
                   let queue = getQueue(channelName);
                   let subscribers = getSubscribersList(channelName);
                   let dispatched = false;
                   if(queue.isEmpty()){
                       try {
                           for (let i = 0; i < subscribers.length; i++) {
                               subscribers[i].write(message);
                               sendStatus(subscribers[i], 200);
                           }
                           if(subscribers.length >0){
                               dispatched = true;
                           }
                       }catch(err) {
                           //... some subscribers could have a timeout connection
                       }
                   }
                   if(!dispatched) {
                       if(queue.length < maxQueueSize){
                           queue.push(message);
                       }else{
                           return sendStatus(res, 429);
                       }

                       /*
                       if(subscribers.length>0){
                           //... if we have somebody waiting for a message and the queue is not empty means that something bad
                           //happened and maybe we should try to dispatch first message from queue
                       }
                       */

                   }
                   return sendStatus(res, 200);
               }
            });
        });
    });

    function getSubscribersList(channelName){
        if(typeof subscribers[channelName] === "undefined"){
            subscribers[channelName] = [];
        }

        return subscribers[channelName];
    }

    server.get("/receive-message/:channelName", function(req, res){
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
                    let queue = getQueue(channelName);
                    let message = queue.pop();

                    if(!message){
                        getSubscribersList().push(res);
                    }else{
                        res.write(message);
                        sendStatus(res, 200);
                    }
                });
            }
        });
    });

}

module.exports = ChannelsManager;