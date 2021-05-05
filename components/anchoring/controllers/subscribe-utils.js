let pendingRequests = {};

const readBody = require("../../../utils").readStringFromStream;

function readChannelForLastMessage(channelIdentifier, lastMessageKnown, callback) {
    readChannel(channelIdentifier, function (err, anchors) {
        if (err) {
            return callback(err);
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
            return callback(null, anchors);
        }
    });
}

function readChannel(name, callback) {
    const fs = require("fs");
    const path = require("swarmutils").path;

    fs.readFile(path.join(storageFolder, name), function (err, content) {
        let anchors;

        if (!err) {
            anchors = content.split("m");
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

        return OpenDSUSafeCallback(callback)(
            createOpenDSUErrorWrapper(`Failed append in file <${path.join(storageFolder, name)}>`, err)
        );
    });
}

module.exports = {
    readBody,
    readChannelForLastMessage,
    readChannel,
    publishToChannel,
};
