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
            path: `/receive-message/${channel}`,
            method: "GET"
        };

        let req = http.request(options, callback);
        return req;
    }

    let testSuite = [];

    let channelName = crypto.randomBytes(24).toString('hex');
    function GetMessageFromInexistentChannel(callback){
        const request = createBasicRequest(channelName, function(res){
                                assert.equal(403, res.statusCode);
                                callback();
                            });
        request.end();
    }
    
    testSuite.push(GetMessageFromInexistentChannel);

    function GetMessageFromChannelAndNoSignature(callback){

        api.createChannel(channelName, "publicKey", function(res){
            assert.equal(200, res.statusCode);
            const request = createBasicRequest(channelName, function(res){
                assert.equal(403, res.statusCode);
                callback();
            });
            request.end();
        });
    }

    testSuite.push(GetMessageFromChannelAndNoSignature);

    function GetMessageFromChannelAndNoToken(callback){
        let channelName = crypto.randomBytes(24).toString('hex');
        api.createChannel(channelName, "publicKey", function(res){
            assert.equal(200, res.statusCode);
            const request = createBasicRequest(channelName, function(res){
                assert.equal(412, res.statusCode);
                callback();
            });
            request.setHeader("signature", "fakeSignature");
            request.end();
        });
    }

    testSuite.push(GetMessageFromChannelAndNoToken);

    function GetMessageFromChannelWithCookieSet(callback){
        let channelName = crypto.randomBytes(24).toString('hex');
        api.createChannel(channelName, "publicKey", function(res){
            assert.equal(200, res.statusCode);

            api.sendMessage(channelName, require("swarmutils").OwM.prototype.convert(api.generateMessage()), "signature", function(res){
                assert.true(200, res.statusCode);

                const request = createBasicRequest(channelName, function(res){
                    assert.true(200, res.statusCode);
                    callback();
                });
                request.setHeader("signature", "fakeSignature");
                request.setHeader("Cookie", ["tokenHeader='randomtoken'"]);
                request.end();
            });
        });
    }

    testSuite.push(GetMessageFromChannelWithCookieSet);


    finish(testSuite);

}

let timeout = 7000;
let testName = "Test getting messages from virtualmq using http";

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