const crypto = require("crypto");
const http = require("http");

require("../../../psknode/bundles/pskruntime");

const doubleCheck = require('../../double-check');
const assert = doubleCheck.assert;

function createTestSuite(api, finish){

    function createBasicRequest(channel, callback){

        const options = {
            hostname: "127.0.0.1",
            port: api.getPort(),
            path: `/create-channel/${channel}`,
            method: "PUT"
        };

        let req = http.request(options, callback);
        return req;
    }

    let testSuite = [];

    let channelName = crypto.randomBytes(24).toString('hex');
    function NoKeyForTheChannel(callback){
        //completing wrong request format sent
        const request = createBasicRequest(channelName, function(res){
                                assert.equal(400, res.statusCode);
                                callback();
                            });
        request.end();
    }
    
    testSuite.push(NoKeyForTheChannel);

    function NoChannelName(callback){
        //completing wrong request format sent
        const request = createBasicRequest("", function(res){
            assert.equal(404, res.statusCode);
            callback();
        });
        request.end();
    }

    testSuite.push(NoChannelName);

    function ChannelNamePath(callback){
        //completing wrong request format sent
        const request = createBasicRequest("../../../veryBad", function(res){
            assert.equal(404, res.statusCode);
            callback();
        });
        request.end();
    }

    testSuite.push(ChannelNamePath);

    function DuplicateChannelName(callback){
        //completing wrong request format sent
        const request = createBasicRequest(channelName, function(res){
            assert.equal(200, res.statusCode);

            const secReq = createBasicRequest(channelName, function(res){
                assert.equal(409, res.statusCode);

                callback();
            });
            secReq.write("somePublicKey");
            secReq.end();
        });
        request.write("somePublicKey");
        request.end();
    }

    testSuite.push(DuplicateChannelName);

    function DuplicateChannelNameAndNoKey(callback){
        //completing wrong request format sent

        const secReq = createBasicRequest(channelName, function(res){
            assert.equal(400, res.statusCode);
            callback();
        });

        secReq.end();
    }

    testSuite.push(DuplicateChannelNameAndNoKey);

    finish(testSuite);

}

let timeout = 7000;
let testName = "Test how a bad message is handled on the create channel endpoint";

require("./Utils/TestInfrastructureUtils").createInfrastructureTest(testName, timeout, "127.0.0.1", function(err, api, finish){
    if(!err){
        createTestSuite(api, function(testSuite){
            testSuite.forEach(function(test){
                 assert.callback(test.name.match(/[A-Z][a-z]+/g).join(" "), test);
            });
            finish();
        });
    }else{
        console.log("No test run.");
    }
});