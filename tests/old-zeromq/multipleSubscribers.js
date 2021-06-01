const crypto = require("crypto");

require("../../../psknode/bundles/pskruntime");

const doubleCheck = require('../../double-check');
const assert = doubleCheck.assert;

function mainTest(api, finishTest){
    channelName = crypto.randomBytes(24).toString('hex');

    let subscribersCount = 0;
    function receiveMessage(callback){
        api.receiveMessage(channelName, "justsignature", callback);
        subscribersCount++;
    }

    api.createChannel(channelName, "publickey", function(res){
        assert.equal(res.statusCode, 200);

        let token = res.headers["tokenHeader"];
        assert.notNull(token);

        let message = api.generateMessage();
        let OwM = require("./../../swarmutils").OwM;
        message = OwM.prototype.convert(message);

        let messageReceivedCounter = 0;
        let responseCounter = 0;
        function validateResult(){
            if(responseCounter === subscribersCount){
                assert.equal(messageReceivedCounter, 1);
                finishTest();
            }
        }

        let i = 10;
        while(i>0){
            receiveMessage((err, res, receivedMessage)=>{
                responseCounter++;
                if(!err){
                    let comparisonResult = message.getMeta("swarmId") === OwM.prototype.getMetaFrom(receivedMessage, "swarmId");
                    assert.true(comparisonResult, "Wrong message received");
                    if(comparisonResult){
                        messageReceivedCounter++;
                    }
                    validateResult();
                }else{
                    assert.equal(403, res.statusCode);
                    console.log("Rejected");
                }
            });
            i--;
        }

        api.sendMessage(channelName, message, "justSignature", (res)=>{
            assert.equal(res.statusCode, 200);
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