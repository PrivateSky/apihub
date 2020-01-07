const zeroMQModuleName = "zeromq";
const zmq = require(zeroMQModuleName);
const child_process = require("child_process");

const pubsAddress = "tcp://127.0.0.1:7000";
const subsAddress = "tcp://127.0.0.1:7001";

console.log("Process pid", process.pid);

const the_publisher = zmq.createSocket("pub");
the_publisher.connect(pubsAddress);

const random_publisher = zmq.createSocket("pub");
random_publisher.connect(pubsAddress);

let channels = [];
let waitingToConnect = {};

const subscriberOneSocket = createSubscriber("miqu");
const subscriberTwoSocket = createSubscriber("tra");
const subscriberThreeSocket = createSubscriber("bu");

function createSubscriber(channelName){
    let subscriber = zmq.createSocket("sub");
    waitingToConnect[channelName] = subscriber;

    subscriber.monitor();
    subscriber.on("connect", ()=>{
       waitingToConnect[channelName] = undefined;
       delete waitingToConnect[channelName];

       if(Object.keys(waitingToConnect)==0){
           startSending();
       }
    });

    subscriber.connect(subsAddress);

    subscriber.on("message", (channel, message)=>{
        console.log("Subscriber Received on channel", channel.toString(), message, message.toString());
    });

    subscriber.subscribe(channelName);
    channels.push(channelName);

    console.log("New subscriber");
    return subscriber;
}

function startSending(){
    console.log("Preparing to send");

    for(let i=0; i<channels.length; i++){
        let message = `Message number [${i+1}]`;
        console.log(`Sending message < ${message} > on channel <<${channels[i]}>>`);
        the_publisher.send([channels[i], i]);
        random_publisher.send([channels[channels.length-1-i], "ReverseMessage"]);
    }

}