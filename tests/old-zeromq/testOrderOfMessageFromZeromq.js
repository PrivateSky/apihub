const crypto = require("crypto");

require("../../../psknode/bundles/pskruntime");

const doubleCheck = require('../../double-check');
const assert = doubleCheck.assert;

function mainTest(api, finishTest){
    channelName = crypto.randomBytes(24).toString('hex');

    let messagesSent = [];
    let messagesReceived = [];
    const howMany = 300;

    function startSending(){
        function oneByOne(){
            let message = api.generateMessage(messagesSent.length.toString());
            let OwM = require("./../../swarmutils").OwM;
            message = OwM.prototype.convert(message);
            messagesSent.push(message);

            api.sendMessage(channelName, message, "signature", function(res){
                assert.equal(res.statusCode, 200);
                //..
            });
        }

        let timer = setInterval(()=>{
            if(messagesSent.length >= howMany){
                return clearInterval(timer);
            }
            oneByOne();
        }, 10);
    }

    function testIfFinish(){
        if(messagesReceived.length === howMany){
            finishTest();
        }else{
            console.log(`Received message number ${messagesReceived.length}`);
        }
    }

    api.createForwardChannel(channelName, "publicKey", function(res){
        assert.equal(res.statusCode, 200);

        let token = res.headers["tokenHeader"];
        assert.notNull(token);

        function readyCallback(){
            startSending();
        }

        function receivedCallback(channel, receivedMessage){
            //console.log("Getting my message back", channel.toString(), receivedMessage.toString());
            let index = require("swarmutils").OwM.prototype.getMetaFrom(receivedMessage, "swarmTypeName");
            index = Number(index);

            console.log(messagesReceived.length, index);
            assert.true(messagesReceived.length == index);

            messagesReceived.push(receivedMessage);
            testIfFinish();
        }

        api.receiveMessageFromZMQ(channelName, "signature", readyCallback, receivedCallback);

    });
}

let timeout = 7000;
let testName = "Test order of messages sent to a channel that has forward enabled";

require("./Utils/TestInfrastructureUtils").createInfrastructureTest(testName, timeout, "127.0.0.1", function(err, api, finish){
    if(!err){
        mainTest(api, finish);
    }else{
        console.log("No test run.");
    }
});