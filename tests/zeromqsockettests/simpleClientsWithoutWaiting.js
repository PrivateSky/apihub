const zmq = require("zeromq");

const pubsAddress = "tcp://127.0.0.1:7000";
const subsAddress = "tcp://127.0.0.1:7001";


const the_publisher = zmq.createSocket("pub");
the_publisher.connect(pubsAddress);

const subscriberOneSocket = zmq.createSocket("sub");
const subscriberTwoSocket = zmq.createSocket("sub");

subscriberOneSocket.connect(subsAddress);
subscriberTwoSocket.connect(subsAddress);

subscriberOneSocket.subscribe("channelOne");
subscriberTwoSocket.subscribe("channelTwo");

subscriberOneSocket.on("message", (channel, message)=>{
    console.log("SubOne", "Received on channel", channel, message.toString());
});

subscriberTwoSocket.on("message", (channel, message)=>{
    console.log("SubTwo", "Received on channel", channel, message.toString());
});

console.log("Preparing to send");
the_publisher.send(["channelOne", "RandomMessage"]);
the_publisher.send(["channelTwo", "NotSomeRandomMessage"]);