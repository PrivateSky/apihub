const URL_PREFIX = "/anchoring";
const anchorsStorage = "anchors";

function AnchoringService(server) {
    const path = require("path");
    const fs = require("fs");

    const AnchorsManager = require("./libs/flows/AnchorsManager");
    const readBody = require("./utils").readStringFromStream;

    let storageFolder = path.join(server.rootFolder, anchorsStorage);

    let storageNotAccessible = false;
    try{
        fs.mkdirSync(storageFolder, {recursive: true});
    }catch(err){
        storageNotAccessible = true;
    }


    $$.flow.start("AnchorsManager").init(storageFolder);

    function setHeaders(req, res, next) {
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Request methods you wish to allow
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

        // Request headers you wish to allow
        res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Content-Length, X-Content-Length');
        next();
    }

    function attachHashToAlias(req, res) {
        $$.flow.start("AnchorsManager").addAlias(req.params.fileId, req.params.lastHash, req, (err, result) => {
            res.statusCode = 201;
            if (err) {
                res.statusCode = 500;

                if (err.code === 'EACCES') {
                    res.statusCode = 409;
                }

                if (err.code === AnchorsManager.ALIAS_SYNC_ERR_CODE) {
                    res.statusCode = 428; // see: https://tools.ietf.org/html/rfc6585#section-3
                }
            }
            res.end();
        });
    }

    function getVersions(req, res) {
        $$.flow.start("AnchorsManager").readVersions(req.params.alias, (err, fileHashes) => {
            res.statusCode = 200;
            if (err) {
                console.error(err);
                res.statusCode = 404;
            }
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(fileHashes));
        });
    }

    function publishHandler(req, res){
        const channelIdentifier = req.params.channelsIdentifier;
        const lastMessage = req.params.lastMessage;

        readBody(req, function(err, newAnchor){
            if(newAnchor === ""){
                //no anchor found in body
                res.statusCode = 428;
                return res.send("");
            }

            readChannel(channelIdentifier, function(err, anchors){
                if(err && typeof lastMessage === "undefined"){
                    // this is a new anchor
                    return publishToChannel(channelIdentifier, newAnchor, function(err){
                        if(err){
                            res.statusCode = 500;
                            return res.send();
                        }
                        res.statusCode = 201;
                        res.send();
                    });
                }

                if(lastMessage !== anchors.pop()){
                    res.statusCode = 403;
                    return res.send();
                }

                return publishToChannel(channelIdentifier, newAnchor, function(err){
                    if(err){
                        res.statusCode = 500;
                        return res.send();
                    }
                    res.statusCode = 201;
                    res.send();
                });
            });
        });
    }

    function readChannel(name, callback){
        const fs = require("fs");
        const path = require("path");

        fs.readFile(path.join(storageFolder, name), function(err, content){
            let anchors;
            if(!err){
                anchors = content.split("\m");
            }
            callback(err, anchors);
        });
    }

    function publishToChannel(name, message, callback){
        const fs = require("fs");
        const path = require("path");

        fs.appendFile(path.join(storageFolder, name), message, function(err){
            if(typeof err === "undefined"){
                //if everything went ok then try to resolve pending requests for that channel
                tryToResolvePendingRequests(name, message);
            }
            return callback(err);
        });
    }

    function tryToResolvePendingRequests(channelIdentifier, message){
        let pending = pendingRequests[channelIdentifier];
        if(typeof  pending === "undefined" || pending.length === 0){
            // no pending requests
            return;
        }

        for(let i=0; i<pending.length; i++){
            let requestPair = pending[i];
            try{
                requestPair.res.statusCode = 200;
                requestPair.res.send(message);
            }catch(err){
                // a pending request can already be resolved as timeout
            }
        }
    }

    let pendingRequests = {};
    function readHandler(req, res){
        const channelIdentifier = req.params.channelsIdentifier;
        const lastMessageKnown = req.params.lastMessage;

        readChannel(channelIdentifier, function(err, anchors){
            if(err){
                if(err.code === "EPERM"){
                    res.statusCode = 500;
                }else{
                    res.statusCode = 404;
                }
                return res.send();
            }
            let knownIndex = anchors.indexOf(lastMessageKnown);
            if(knownIndex !== -1){
                anchors = anchors.slice(knownIndex+1);
            }
            if(anchors.length === 0){
                if(typeof pendingRequests[channelIdentifier] === "undefined"){
                    pendingRequests[channelIdentifier] = [];
                }
                pendingRequests[channelIdentifier].push({req, res});
            }else{
                res.statusCode = 200;
                return res.send(anchors);
            }
        });
    }

    function storageNotAccessibleHandler(req, res, next){
        if(storageNotAccessible){
            res.statusCode = 500;
            return res.send("");
        }
        next();
    }

    //don't need to have this middleware registration because is resolved in psk-apihub/index.js already
    //server.use(`${URL_PREFIX}/*`, setHeaders);

    //new API
    server.use(`${URL_PREFIX}/*`, storageNotAccessibleHandler);
    //we need this handler (without lastMessage) to catch request for new anchors
    server.post(`${URL_PREFIX}/publish/:channelIdentifier/`, publishHandler);
    server.post(`${URL_PREFIX}/publish/:channelIdentifier/:lastMessage`, publishHandler);
    server.get(`${URL_PREFIX}/read/:channelIdentifier`, readHandler);

    //to become obsolete soon
    server.post(`${URL_PREFIX}/attachHashToAlias/:fileId/:lastHash`, attachHashToAlias);
    server.post(`${URL_PREFIX}/attachHashToAlias/:fileId`, attachHashToAlias);
    server.get(`${URL_PREFIX}/getVersions/:alias`, getVersions);
}

module.exports = AnchoringService;