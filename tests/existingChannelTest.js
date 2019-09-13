/** Basic test that focuses on the POST request and the number of posted messages corresponding 
 * to the expected result*/

const utils = require("../Utils/virtualMQUtils");
const assert = require("double-check").assert;
var msgArr = ['msg_1', 'msg_2', 'msg_3', 'msg_4', 'msg_5'];
var countMsg = 1;
var index = 0;
finishCallback = null;

var postCallback = function () {
    index++;
    if (index == msgArr.length) {
        return;
    }
    if (index == 1) {
        // just wait for file structure to be created
        setTimeout(() => {
            utils.httpRequest(utils.createSwarmMessage(msgArr[index]), postCallback);
        }, 5000);
    } else {
        utils.httpRequest(utils.createSwarmMessage(msgArr[index]), postCallback);
    }
};

var verify = function(data){
    var expected = utils.createSwarmMessage(msgArr[countMsg]);
    countMsg++;
    console.log("Got message", data);
    console.log("Expected message ", expected);
    assert.equal(expected, data, "Did not receive the right message back");

    if (countMsg == msgArr.length) {
        finishCallback();
        process.exit(0);
    }
}

function test(finish) {
    finishCallback = finish;
    utils.createServer((server) => {
        postCallback(utils.createSwarmMessage(msgArr[index]));
        setTimeout(()=>{
            setInterval(()=> {
                utils.httpRequest(null, verify, 'GET');
            },100);
        }, 15000);
    });
}

utils.initVirtualMQ();
assert.callback("VirtualMQ POST & GET requests test", test, 20000);
//delete creted test folder
utils.cleanUp(20500);