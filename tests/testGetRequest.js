/* this is a simple test that creates a message, posts it, and then gets is back 
 and verifies if results match */

const utils = require("../Utils/virtualMQUtils");
const assert = require("double-check").assert;

var content = JSON.stringify(
    {
        meta:{
            swarmId: 00003,
            requestId: 00003,
            swarmTypeName: 'testSwarm',
            phaseName: 'testPhase',
            args: undefined,
            command: 'relay',
            target: 'agent\\agent_x'
        }
    }
);

var messageCreation = function(){
    utils.httpRequest(utils.createSwarmMessage(content));
    console.log("created message", content);
}

let verify = function(data){
    var expected = messageCreation();
    console.log("Got message", data);
    console.log("Expected message ", expected);
    assert.equal(expected, data, "Did not receive the right message back");
}

function testGet(finish){
    utils.createServer((server) => {
        utils.httpRequest(null, verify, 'GET');
        finish();
        process.exit(0);
    });
}

utils.initVirtualMQ();
assert.callback("VirtualMQ GET request test", testGet, 25000);
//delete creted test folder
utils.cleanUp(25000 + 3000);