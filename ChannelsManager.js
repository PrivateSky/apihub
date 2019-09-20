const storageFolder = process.env.channel_storage || "../tmp";
const defaultQueueSize = process.env.queue_size || 100;

const channelsFolderName = "channels";
const channelKeyFileName = "channel_key";

const path = require("path");
const fs = require("fs");

function ChannelsManager(server){

    const rootFolder = path.join(storageFolder, channelsFolderName);
    fs.mkdirSync(rootFolder, {recursive: true});

    const channelKeys = {};

    function createChannel(name, publicKey, callback){
        let channelFolder = path.join(rootFolder, name);
        let keyFile = path.join(channelFolder, channelKeyFileName);

        if(typeof channelKeys[name] !== "undefined" || fs.existsSync(channelFolder)){
            return callback(new Error("channel exists!"));
        }

        fs.mkdirSync(channelFolder);

        if(fs.existsSync(keyFile)){
            return callback(new Error("channel has owner set!"));
        }

        fs.writeFile(keyFile, publicKey, (err, res)=>{
            if(!err){
                channelKeys[name] = publicKey;
            }
            callback(err, res);
        });
    }

    function retriveChannelKey(channelName, callback){
        if(typeof channelKeys[channelName] !== "undefined"){
            return callback(null, channelKeys[channelName]);
        }else{
            fs.readFile(path.join(rootFolder, channelName, channelKeyFileName), (err, res)=>{
                if(res){
                    channelKeys[channelName] = res;
                }
                callback(err, res);
            });
        }
    }

    function setForwardChannel(channelName){

    }

    function stopForwardChannel(channelName){

    }

    server.post("/create-chanel", function(req, res){
        const {channelName, publicKey} = req.body;

        if(typeof channelName !== "string" || typeof publicKey !== "string"){
            return sendStatus(res, 400);
        }

        createChannel(channelName, publicKey, getBasicReturnHandler(res));
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

module.exports = ChannelsManager(server);