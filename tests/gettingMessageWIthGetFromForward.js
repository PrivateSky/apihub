const crypto = require("crypto");

require("../../../psknode/bundles/pskruntime");

const doubleCheck = require('../../double-check');
const assert = doubleCheck.assert;

function mainTest(api, finishTest){
    channelName = crypto.randomBytes(24).toString('hex');



    api.createForwardChannel(channelName, "publicKey", (res)=>{
        assert.equal(res.statusCode, 200);

        let token = res.headers["tokenHeader"];
        assert.notNull(token);

        let message = api.generateMessage();

        let OwM = require("./../../swarmutils").OwM;
        message = OwM.prototype.convert(message);

        api.sendMessage(channelName,  message, "signature", (res)=>{
            assert.equal(res.statusCode, 200);

            api.receiveMessage(channelName, "signature", (err, res)=>{
                //request is failling and IT SHOULD!!!
                assert.equal(res.statusCode, 409, "Should not be able to get message from channel that is forwarded");

                finishTest();
            });
        });
    });
}

let timeout = 10000;
let testName = "Failing to retrive a message from a channel that has forward to zeromq enable";

require("./Utils/TestInfrastructureUtils").createInfrastructureTest(testName, timeout, "127.0.0.1", function(err, api, finish){
    if(!err){
        mainTest(api, finish);
    }else{
        console.log("No test run.");
    }
});