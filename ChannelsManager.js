const storageFolder = process.env.channel_storage || "../tmp";
const defaultQueueSize = process.env.queue_size || 100;
const tokenSize = process.env.token_size || 48;
const tokenHeaderName = process.env.token_header_name || "tokenHeader";

const channelsFolderName = "channels";
const channelKeyFileName = "channel_key";

const path = require("path");
const fs = require("fs");
const crypto = require('crypto');

function ChannelsManager(server){

    const rootFolder = path.join(storageFolder, channelsFolderName);
    fs.mkdirSync(rootFolder, {recursive: true});

    const channelKeys = {};

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

        fs.writeFile(keyFile, JSON.stringify({publicKey, token}), (err, res)=>{
            if(!err){
                channelKeys[name] = publicKey;
            }
            return callback(err, !err ? token : undefined);
        });
    }

    function retriveChannelKey(channelName, callback){
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

    function setForwardChannel(channelName){

    }

    function stopForwardChannel(channelName){

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

    server.post("/forward-channel", function(req, res){
        const {channelName, enable, signature} = req.body;

        if(typeof channelName !== "string" || typeof signature !== "string"){
            return sendStatus(res, 400);
        }

        retriveChannelKey(channelName, (err, key)=>{
            if(err){
                return sendStatus(res, 500);
            }else{
                //todo: check signature against key

                if(enable){
                    setForwardChannel(channelName, getBasicReturnHandler(res));
                }else{
                    stopForwardChannel(channelName, getBasicReturnHandler(res));
                }
            }
        });

    });

    server.post("/add-message/:channelName", function(req, res){

    });

    server.post("/receive-message/:channelName", function(req, res){

    });

}

module.exports = ChannelsManager;