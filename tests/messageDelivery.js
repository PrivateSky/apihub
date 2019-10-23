const crypto = require("crypto");

require("../../../psknode/bundles/pskruntime");

const doubleCheck = require('../../double-check');
const assert = doubleCheck.assert;

function mainTest(api, finishTest){
    channelName = crypto.randomBytes(24).toString('hex');

    api.createChannel(channelName, "publickey", function(res){
        assert.equal(res.statusCode, 200);

        let token = res.headers["tokenHeader"];
        assert.notNull(token);

        let message = api.generateMessage();

        let OwM = require("./../../swarmutils").OwM;
        message = OwM.prototype.convert(message);

        api.sendMessage(channelName, message, "signature", function(res){
            assert.equal(res.statusCode, 200);

            api.receiveMessage(channelName, "signature", function(err, res, receivedMessage){
                assert.equal(200, res.statusCode);
                console.log(receivedMessage);
                assert.equal(message.getMeta("swarmId"), OwM.prototype.getMetaFrom(receivedMessage, "swarmId"), "Wrong message received");

                finishTest();
            });
        });
    });
}

let timeout = 3000;
let testName = "Message Delivery Test";

require("./Utils/TestInfrastructureUtils").createInfrastructureTest(testName, timeout, "127.0.0.1", function(err, api, finish){
    if(!err){
        mainTest(api, finish);
    }else{
        console.log("No test run.");
    }
});