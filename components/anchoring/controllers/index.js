const { ALIAS_SYNC_ERR_CODE } = require("../utils");
const { readChannelForLastMessage, readBody, readChannel, publishToChannel } = require("./subscribe-utils");

function getHandlerForAnchorCreateOrAppend(response) {
    return (err, result) => {
        if (err) {
            
            const errorMessage = typeof err === "string" ? err : err.message;
            if (err.code === "EACCES") {
                return response.send(409, errorMessage);
            } else if (err.code === ALIAS_SYNC_ERR_CODE) {
                // see: https://tools.ietf.org/html/rfc6585#section-3
                return response.send(428, errorMessage);
            } else if (err.code === 403) {
                return response.send(403, errorMessage);
            }

            return response.send(500, errorMessage);
        }

        response.send(201);
    };
}

function createAnchor(request, response) {
    request.strategy.createAnchor(getHandlerForAnchorCreateOrAppend(response));
}

function appendToAnchor(request, response) {
    request.strategy.appendToAnchor(getHandlerForAnchorCreateOrAppend(response));
}

function getAllVersions(request, response) {
    request.strategy.getAllVersions((err, fileHashes) => {
        if (err) {
            return response.send(404, "Anchor not found");
        }

        response.setHeader("Content-Type", "application/json");

        return response.send(200, fileHashes);
    });
}

function readHandler(req, res, next) {
    const channelIdentifier = req.params.channelsIdentifier;
    const lastMessageKnown = req.params.lastMessage;

    readChannelForLastMessage(channelIdentifier, lastMessageKnown, function (err, anchors) {
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
                        return reponse.send(500, "Internal error");
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

module.exports = {
    createAnchor,
    appendToAnchor,
    getAllVersions,
    readHandler,
    publishHandler,
};
