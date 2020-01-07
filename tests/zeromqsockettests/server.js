const zeroMQModuleName = "zeromq";
const zmq = require(zeroMQModuleName);

const pubsAddress = "tcp://127.0.0.1:7000";
const subsAddress = "tcp://127.0.0.1:7001";

const pubs = zmq.createSocket('xsub');
const subs = zmq.createSocket('xpub');

//subs.setsockopt(zmq.ZMQ_XPUB_VERBOSE, 1);

pubs.on('message', (...args) => {
    console.log("Dispatched", ...args);
    subs.send(args);
});

subs.on('message', (data) => {
    pubs.send(data);
});

pubs.bindSync(pubsAddress);
subs.bindSync(subsAddress);
console.log("Bind finised on", pubsAddress, subsAddress);
const events = ["SIGINT", "SIGUSR1", "SIGUSR2", "uncaughtException", "SIGTERM", "SIGHUP"];

events.forEach(event => {
    process.on(event, () => {
        pubs.close();
        subs.close();
    });
});