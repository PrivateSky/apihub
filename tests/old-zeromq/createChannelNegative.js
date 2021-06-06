const crypto = require("crypto");

require("../../../psknode/bundles/pskruntime");

const doubleCheck = require('../../double-check');
const assert = doubleCheck.assert;

function mainTest(api, finishTest){
    channelName = crypto.randomBytes(24).toString('hex');

    api.createChannel(channelName, "mysuperkey", function(res){
        assert.equal(res.statusCode, 200);

        let token = res.headers["tokenHeader"];
        assert.notNull(token);

        api.createChannel(channelName, "mysuperkey", function(res){
            assert.equal(res.statusCode, 409);

            finishTest();
        });
    });
}
let timeout = 3000;
let testName = "Create Channel Negative Test";

require("./Utils/TestInfrastructureUtils").createInfrastructureTest(testName, timeout, "127.0.0.1", function(err, api, finish){
    if(!err){
        mainTest(api, finish);
    }else{
        console.log("No test run.");
    }
});