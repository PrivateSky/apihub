const crypto = require("crypto");

require("../../../psknode/bundles/pskruntime");

const doubleCheck = require('../../double-check');
const assert = doubleCheck.assert;

function mainTest(api, finishTest){
    channelName = crypto.randomBytes(24).toString('hex');

    api.createForwardChannel(channelName, "my-public-key",(res)=>{
        assert.equal(res.statusCode, 200);

        let token = res.headers["tokenHeader"];
        assert.notNull(token);

        let message = api.generateMessage();

        let OwM = require("./../../swarmutils").OwM;
        message = OwM.prototype.convert(message);

        function zmqConnected(){
            console.log("ZMQ connected!");
        }

        function receivedMessage(channel, receivedMessage){
            console.log(channel, channelName);
            assert.equal(channel, channelName, "Received a message from wrong channel");
            assert.equal(message.getMeta("swarmId"), OwM.prototype.getMetaFrom(receivedMessage, "swarmId"), "Wrong message received");
            finishTest();
        }

        api.receiveMessageFromZMQ(channelName, "justASimpleSignature", zmqConnected, receivedMessage);

        setTimeout(function(){
            api.sendMessage(channelName, message, "justASimpleSignature", function(res){
                assert.equal(res.statusCode, 200, "Failed to send message");
            });
        }, 1000);

    });
}

let timeout = 10000;
let testName = "Retrive a message from a zeromq channel that has messages forward enable";

require("./Utils/TestInfrastructureUtils").createInfrastructureTest(testName, timeout, "127.0.0.1", function(err, api, finish){
    if(!err){
        mainTest(api, finish);
    }else{
        console.log("No test run.");
    }
});