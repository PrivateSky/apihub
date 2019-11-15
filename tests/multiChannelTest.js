const crypto = require("crypto");

require("../../../psknode/bundles/pskruntime");

const doubleCheck = require('../../double-check');
const assert = doubleCheck.assert;

function mainTest(api, finishTest){
    function generateChannelName(){
        return crypto.randomBytes(24).toString('hex');
    }

    const numberOfChannels = 10;
    const channelList = [];

    for(let i=0; i<numberOfChannels; i++){
        channelList.push(generateChannelName());
    }

    for(let i=0; i<channelList.length; i++){
        const channel = channelList[i];
        api.createChannel(channel, "randomKey", function(res){
            assert.equal(200, res.statusCode);
            runTests(channel);
        });
    }

    let firstAssertCalled = false;
    function runTests(channelName){
        for(let i=0; i<testSuite.length; i++){
            setTimeout(function(){
                testSuite[i](channelName);
            }, 0);
        }
        if(!firstAssertCalled){
            firstAssertCalled = true;
            finishTest();
        }
    }

    function pushMessages(channelName){
        assert.callback("Sending a message on channel "+channelName, function(callback){
            let swarmTypeName = "swarm"+channelName;
            let msg = api.generateMessage(swarmTypeName);
            let OwM = require("./../../swarmutils").OwM;
            msg = OwM.prototype.convert(msg);
            api.sendMessage(channelName, msg, "signature", function(res){
                assert.true(200, res.statusCode);
                callback();
            });
        });
    }

    function getMessages(channelName){
        assert.callback("Receiving a message on channel "+channelName, function(callback){
            let swarmTypeName = "swarm"+channelName;
            api.receiveMessage(channelName, "signature", function(err, res, message){
                if (err) {
                    console.error(err);
                }
                assert.true(typeof err === "undefined" || err === null);
                assert.true(200, res.statusCode);
                assert.true(swarmTypeName, message.swarmTypeName, "Received wrong message");
                callback();
            });
        });
    }

    let testSuite = [];
    let runs = Math.random()*5+1;
    for(let t=0; t < runs; t++){
        testSuite.push(pushMessages);
    }

    for(let t=0; t < runs; t++){
        testSuite.push(getMessages);
    }

}

let timeout = 10000;
let testName = "Test multi channel behaviour";

require("./Utils/TestInfrastructureUtils").createInfrastructureTest(testName, timeout, "127.0.0.1", function(err, api, finish){
    if(!err){
        mainTest(api, finish);
    }else{
        console.log("No test run.");
    }
});
