const integration = require("./../zmq_adapter");
const forwarder = integration.testIfAvailable() ? integration.getForwarderInstance(serverConfigUtils.getConfig('zeromqForwardAddress')) : false;

function createChannelHandler(req, res, next) {
    const channelName = req.params.channelName;

    readBody(req, (err, message) => {
        if (err) {
            return sendStatus(res, 400);
        }

        const publicKey = message;
        if (typeof channelName !== "string" || channelName.length === 0 ||
            typeof publicKey !== "string" || publicKey.length === 0) {
            return sendStatus(res, 400);
        }

        let handler = getBasicReturnHandler(res);

        createChannel(channelName, publicKey, (err, token) => {
            if (!err) {
                const tokenSize = serverConfigUtils.getConfig('endpointsConfig', 'virtualMQ', 'tokenSize');

                res.setHeader('Cookie', [`${tokenSize}=${token}`]);
            }
            handler(err, res);
        });
    });
}

function enableForwarderHandler(req, res, next) {
    if (integration.testIfAvailable() === false) {
        return sendStatus(res, 417);
    }
    readBody(req, (err, message) => {
        const { enable } = message;
        const channelName = req.params.channelName;
        const headerSignature = serverConfigUtils.getConfig('endpointsConfig', 'virtualMQ', 'signatureHeaderName');
        const signature = req.headers[headerSignature];

        if (typeof channelName !== "string" || typeof signature !== "string") {
            return sendStatus(res, 400);
        }

        retrieveChannelDetails(channelName, (err, details) => {
            if (err) {
                return sendStatus(res, 500);
            } else {
                //todo: check signature against key [details.publickey]

                if (typeof enable === "undefined" || enable) {
                    forwardChannel(channelName, true, getBasicReturnHandler(res));
                } else {
                    forwardChannel(channelName, null, getBasicReturnHandler(res));
                }
            }
        });
    });
}

function sendMessageHandler(req, res, next) {
    let channelName = req.params.channelName;

    checkIfChannelExist(channelName, (err, exists) => {
        if (!exists) {
            return sendStatus(res, 403);
        }

        retrieveChannelDetails(channelName, (err, details) => {
            //we choose to read the body of request only after we know that we recognize the destination channel
            readSendMessageBody(req, (err, message) => {
                if (err) {
                    //console.log(err);
                    return sendStatus(res, 403);
                }

                let header;

                try {
                    header = SwarmPacker.unpack(message.buffer);
                } catch (error) {
                    //console.log(error);
                    return sendStatus(res, 400);
                }
                //TODO: to all checks based on message header

                if (integration.testIfAvailable() && details.forward) {
                    //console.log("Forwarding message <", message, "> on channel", channelName);
                    forwarder.send(channelName, message);
                } else {
                    let queue = getQueue(channelName);
                    let subscribers = getSubscribersList(channelName);
                    let dispatched = false;
                    const maxSize = serverConfigUtils.getConfig('endpointsConfig', 'virtualMQ', 'maxSize');

                    if (queue.isEmpty()) {
                        dispatched = writeMessage(subscribers, message);
                    }

                    if (!dispatched) {
                        if (queue.length < maxSize) {
                            queue.push(message);
                        } else {
                            //queue is full
                            return sendStatus(res, 429);
                        }
                    }
                }
                return sendStatus(res, 200);
            });
        })

    });
}

function receiveMessageHandler(req, res, next) {
    let channelName = req.params.channelName;
    checkIfChannelExist(channelName, (err, exists) => {
        if (!exists) {
            return sendStatus(res, 403);
        } else {
            retrieveChannelDetails(channelName, (err, details) => {
                if (err) {
                    return sendStatus(res, 500);
                }
                //TODO: check signature agains details.publickey


                if (details.forward) {
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

                if (!message) {
                    getSubscribersList(channelName).push(res);
                } else {
                    deliverMessage(res, message);
                }
            });
        }
    });
}

module.exports = {
    createChannelHandler,
    enableForwarderHandler,
    sendMessageHandler,
    receiveMessageHandler
};
