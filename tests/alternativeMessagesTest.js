/* This test aims to test if a the framework supports both invalid and valid messages at a time, without cracking */

const utils = require("../Utils/virtualMQUtils");
const assert = require("double-check").assert;

var index = 0; swarmIndex = 0;
var validMsgArr = ['valid_1', 'valid_2', 'valid_3', 'valid_4', 'valid_5'];
var invalidMsgArr = ['invalid_1', 'invalid_2', 'invalid_3', 'invalid_4', 'invalid_5'];
var countValidMsg = 0, countInvalidMsg = 0, getMessageInterval, finishCallback;

var postMessage = function (msg) {
    console.log('Post bad message', msg);
    index++;
    if (index == invalidMsgArr.length) {
        clearInterval(getMessageInterval);
        return;
    }
    if (index == 1) {
        console.log('Wait for the entire structure to build');
        setTimeout(() => {
            utils.httpRequest(invalidMsgArr[index], postMessage);
        }, 5000)
    } else {
        utils.httpRequest(invalidMsgArr[index], postMessage);
    }
           
    console.log("Post good message", msg);
    swarmIndex++;
    if (swarmIndex == validMsgArr.length) {
        clearInterval(getMessageInterval);
        return;
    }
    utils.httpRequest(utils.createSwarmMessage(validMsgArr[swarmIndex]), postMessage);
};

var verifyValidMsg = function (data) {
    var expected = utils.createSwarmMessage(validMsgArr[countValidMsg]);
    countValidMsg++;
    console.log("Got message", data);
    console.log("Expected message ", expected);
    if (countValidMsg == validMsgArr.length) {
        clearInterval(getMessageInterval);
        utils.deleteFolder(folder);
        finishCallback();
        process.exit(0);
    }else{
        assert.equal(expected, data, "Did not receive the right message back");
    }
};

function getMessageFromQueue(finish) {
    finishCallback = finish;
    //making a get request that will wait until timeout or somebody puts a message on the channel
    utils.httpRequest(null, verifyValidMsg, 'GET');
}

function test(finish) {
    utils.createServer((server) => {
        try {
            //here we try to post some messages as strings (not valid messages)
             utils.httpRequest(invalidMsgArr[index], postMessage);
        } catch (e) {
            console.log(' Message could not be posted --------');
        }
        //here we sent some messages as JSON (valid messages)
            utils.httpRequest(utils.createSwarmMessage(validMsgArr[swarmIndex]), postMessage);
       
        setTimeout(() => {
            getMessageInterval = setInterval(() => {
                getMessageFromQueue(finish)
            }, 100);
        }, 10000);
    });
}

//creating the test folder
utils.initVirtualMQ();
//calling the test function
assert.callback("VirtualMQ valid and invalid messages post test", test, 15000);
//delete created test folder
utils.cleanUp(20000);