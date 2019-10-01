const defaultForwardAddress = process.env.vmq_zeromq_forward_address || "tcp://127.0.0.1:5000";
const defaultSubAddress = process.env.vmq_zeromq_sub_address || "tcp://127.0.0.1:5000";
const defaultPubAddress = process.env.vmq_zeromq_pub_address || "tcp://127.0.0.1:5001";

let zmq = require("../../../node_modules/zeromq");

function registerKiller(children, method){
    const events = ["SIGINT", "SIGUSR1", "SIGUSR2", "uncaughtException", "SIGTERM", "SIGHUP"];

    events.forEach(function(event){
        process.on(event, function(){
            children.forEach(function(child){
                if(method){
                    child[method](0);
                }else{
                    child.close();
                }
            });
        });
    });
}

function ZeromqForwarder(bindAddress){

    let socket = zmq.socket("pub");
    let initialized = false;

    let delay = 500;
    function connect(){
        socket.connect(bindAddress, (err)=>{
            if(err){
                console.log(`Got error connecting to zeromq server. Trying again in ${delay}ms`);
                setTimeout(()=>{
                    connect();
                    delay = (delay * 1.5) / 4500;
                }, delay);
            }else{
                console.log(`Zeromq forwarder connected on ${bindAddress}`);
                initialized = true;
                sendBuffered();
            }
        });
    }

    connect();

    socket.on("message", (message)=>{
        console.log(message);
    });

    registerKiller([socket]);

    const Queue = require("swarmutils").Queue;
    let buffered = new Queue();

    let sendBuffered = ()=>{
        while(buffered.length>0){
            this.send(buffered.pop());
        }
    };

    this.send = function(channel, ...args){
        if(initialized){
            socket.send([channel, ...args]);
        }else{
            buffered.push([channel, ...args]);
        }
    }
}

function ZeromqProxyNode(subAddress, pubAddress, signatureChecker){

    const publishersNode = zmq.createSocket('xsub');
    const subscribersNode = zmq.createSocket('xpub');

    // By default xpub only signals new subscriptions
    // Settings it to verbose = 1 , will signal on every new subscribe
    // uncomment next lines if messages are lost
    subscribersNode.setsockopt(zmq.ZMQ_XPUB_VERBOSE, 1);

    publishersNode.on('message', (...args) => {
        subscribersNode.send(args);
    });

    subscribersNode.on('message', (message) => {
        if(typeof signatureChecker === "undefined"){
            //no signature checker defined then transparent proxy...
            return publishersNode.send(message);
        }

        if(!Buffer.isBuffer(message)){
            console.log("Signature checker is defined but wrong message type received!");
            return ;
        }

        try{
            let deserializedData = JSON.parse(message);
            //check deserializedData.signature
            signatureChecker(deserializedData.channel, signature, (err, res)=>{
                if(err){
                    //
                }else{
                    publishersNode.send(deserializedData.channel);
                }
            });
        }catch(err){
            console.log("Wrong subscribe message type. No subscription will be made");
        }

    });

    try{
        console.log(`Starting ZeroMQ proxy on [subs:${subAddress}] [pubs:${pubAddress}]`);
        publishersNode.bindSync(pubAddress);
        subscribersNode.bindSync(subAddress);
    }catch(err){
        console.log("Caught error on binding", err);
        throw new Error("No zeromq!!!");
    }

    registerKiller([publishersNode, subscribersNode]);
}

let instance;
module.exports.getForwarderInstance = function(address){
    if(!instance){
        address = address || defaultForwardAddress;
        instance = new ZeromqForwarder(address);
    }
    return instance;
};

module.exports.createZeromqProxyNode = function(subAddress, pubAddress, signatureChecker){
    subAddress = subAddress || defaultSubAddress;
    pubAddress = pubAddress || defaultPubAddress;
    return new ZeromqProxyNode(subAddress, pubAddress, signatureChecker);
};

module.exports.registerKiller = registerKiller;