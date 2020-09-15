let pendingRequests = {};

const readBody = require("../../../utils").readStringFromStream;

function readHandler(req, res, next) {
    const channelIdentifier = req.params.channelsIdentifier;
    const lastMessageKnown = req.params.lastMessage;

    readChannel(channelIdentifier, function (err, anchors) {
        if (err) {
            return res.send(err.code === "EPERM" ? 500 : 404);
        }

        const hasLastMessage = anchors.indexOf(lastMessageKnown);

        if (hasLastMessage !== -1) {
            anchors = anchors.slice(knownIndex + 1);
        }

        if (anchors.length === 0) {
            if (typeof pendingRequests[channelIdentifier] === "undefined") {
                pendingRequests[channelIdentifier] = [];
            }

            pendingRequests[channelIdentifier].push({ req, res });
        } else {
            return res.send(200, anchors);
        }
    });
}

function readChannel(name, callback) {
    const fs = require("fs");
    const path = require("swarmutils").path;

    fs.readFile(path.join(storageFolder, name), function (err, content) {
        let anchors;

        if (!err) {
            anchors = content.split("\m");
        }

        callback(err, anchors);
    });
}

function publishToChannel(name, message, callback) {
    const fs = require("fs");
    const path = require("swarmutils").path;

    fs.appendFile(path.join(storageFolder, name), message, function (err) {
        if (typeof err === "undefined") {
            //if everything went ok then try to resolve pending requests for that channel
            tryToResolvePendingRequests(name, message);
        }
        
        return callback(err);
    });
}

function publishHandler(request, reponse, next) {
    const channelIdentifier = request.params.channelsIdentifier;
    const lastMessage = request.params.lastMessage;

    readBody(request, function (err, newAnchor) {
        if (newAnchor === "") {
            return res.send(428);
        }

        readChannel(channelIdentifier, function (err, anchors) {
            if (err && typeof lastMessage === "undefined") {
                // this is a new anchor
                return publishToChannel(channelIdentifier, newAnchor, function (err) {
                    if (err) {
                        return reponse.send(500, 'Internal error');
                    }

                    return reponse.send(201);
                });
            }

            if (lastMessage !== anchors.pop()) {
                return reponse.send(403);
            }

            return publishToChannel(channelIdentifier, newAnchor, function (err) {
                if (err) {
                    return reponse.send(500);
                }

                reponse.send(201);
                next();
            });
        });
    });
}

module.exports = { readHandler, publishHandler };
