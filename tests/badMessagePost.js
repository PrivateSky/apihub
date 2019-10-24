const crypto = require("crypto");
const http = require("http");

require("../../../psknode/bundles/pskruntime");

const doubleCheck = require('../../double-check');
const assert = doubleCheck.assert;

function createTestSuite(api, finish){
    channelName = crypto.randomBytes(24).toString('hex');

    function createBasicRequest(callback){
        const options = {
            hostname: "127.0.0.1",
            port: api.getPort(),
            path: `/send-message/${channelName}`,
            method: "POST"
        };

        req = http.request(options, callback);
        return  req;
    }

    let testSuite = [];

    function SendCompleteWrongMessage(callback){
        //completing wrong request format sent
        const firstRequest = createBasicRequest(function(res){
                                assert.equal(403, res.statusCode);
                                callback();
                            });
        firstRequest.write("someDummyMessageThatWillfail");
        firstRequest.end();
    }

    testSuite.push(SendCompleteWrongMessage);

    function SendGoodHeadersWrongMessage(callback){
        const firstRequest = createBasicRequest(function(res){
                                assert.equal(400, res.statusCode);
                                callback();
                            });
        firstRequest.setHeader("signature", "someWrongSignature");
        firstRequest.setHeader("content-length", 12);
        firstRequest.setHeader("content-type", 'application/octet-stream');

        firstRequest.write("someDummyMessageThatWillfail");
        firstRequest.end();
    }

    testSuite.push(SendGoodHeadersWrongMessage);

    function SendEmptyRequest(callback){
        let req = createBasicRequest(function(res){
                        assert.equal(403, res.statusCode);
                        callback();
                    });
        req.end();
    }

    testSuite.push(SendEmptyRequest);

    function SendRequestWithoutHeaders(callback){
        const req = createBasicRequest(function(res){
                        assert.equal(403, res.statusCode);
                        callback();
                    });
        req.write("someDummyMessageThatWillfail");
        req.end();
    }
    testSuite.push(SendRequestWithoutHeaders);


    api.createForwardChannel(channelName, "publicKey", function(res){
        assert.equal(res.statusCode, 200);

        let token = res.headers["tokenHeader"];
        assert.notNull(token);

        finish(testSuite);
    });
}

let timeout = 7000;
let testName = "Test how a bad message is handled";

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