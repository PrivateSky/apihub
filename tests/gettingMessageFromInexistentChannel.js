const crypto = require("crypto");

require("../../../psknode/bundles/pskruntime");

const doubleCheck = require('../../double-check');
const assert = doubleCheck.assert;

function mainTest(api, finishTest){
    channelName = crypto.randomBytes(24).toString('hex');

    api.receiveMessage(channelName, "justasignature", function(err, res, message){
       assert.equal(403, res.statusCode);
       finishTest();
    });
}

let timeout = 10000;
let testName = "Retrive a message from an inexistent channel";

require("./Utils/TestInfrastructureUtils").createInfrastructureTest(testName, timeout, "127.0.0.1", function(err, api, finish){
    if(!err){
        mainTest(api, finish);
    }else{
        console.log("No test run.");
    }
});