/* This test aims to test if a get request works for other types of messages
 than the swarm messages in JSON format.
 The test should pass, but should show some errors in the console due to the bad message format */

const utils = require("../Utils/virtualMQUtils");
const assert = require("double-check").assert;
var index = 0;
swarmIndex = 0;
var msgArr = ['msg_1', 'msg_2', 'msg_3', 'msg_4', 'msg_5'];
var invalidMsgArr = ['msg_6', 'msg_7', 'msg_8', 'msg_9', 'msg_10'];
var countMsg = 0,countInvalidMsg = 0, getMessageInterval, finishCallback;

let stringMessage = async function (msg) {
    console.log('------------ index', index);
    index++;
    try {
        if (index == invalidMsgArr.length) {
            assert.equals(countInvalidMsg,invalidMsgArr.length, 'Wrong number of invalid messages');
            return;
        }
        if (index == 1) {
            setTimeout(() => {
                utils.httpRequest(invalidMsgArr[index], stringMessage);
            }, 5000);
        } else {
            utils.httpRequest(invalidMsgArr[index], stringMessage);
        }

    } catch (err) {
        console.log('Error ---------- ', err);
        index++;
        countInvalidMsg++;
    }
};

let swarmMessage = function (msg) {
    console.log("Post good message", msg);
    swarmIndex++;
    if (swarmIndex == msgArr.length) {
        return;
    }
    if (swarmIndex == 1) {
        setTimeout(() => {
            utils.httpRequest(utils.createSwarmMessage(msgArr[swarmIndex]), swarmMessage);
        }, 5000);
    } else {
        utils.httpRequest(utils.createSwarmMessage(msgArr[swarmIndex]), swarmMessage)
    }
};

let verify = function (data) {
    var expected = utils.createSwarmMessage(msgArr[countMsg]);
    countMsg++;
    console.log("Got message", data);
    console.log("Expected message ", expected);


    if (countMsg == msgArr.length) {
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
    utils.httpRequest(null, verify, 'GET');
}

function test(finish) {
    utils.createServer((server) => {
        //stringMessage();
        try {
            //here we try to post some messages as strings (not valid messages)
            utils.httpRequest(invalidMsgArr[index], stringMessage);
        } catch (e) {
            console.log(' Message could not be posted --------');
        }

        //here we sent some messages as JSON

        setTimeout(() => {
            assert.equal(countInvalidMsg,invalidMsgArr.length, 'Wrong number of invalid messages');
            utils.httpRequest(utils.createSwarmMessage(msgArr[swarmIndex]), swarmMessage);
        }, 20000);

        setTimeout(() => {
            getMessageInterval = setInterval(() => {
                getMessageFromQueue(finish)
            }, 100);
        }, 26000);
    });
}

process.on('uncaughtException', function (err) {
        console.log('MQ Fail ', err);
    }
);
//creating the test folder
utils.initVirtualMQ();
//calling the test function
assert.callback("VirtualMQ POSSSSST request test", test, 40000);
//delete created test folder
utils.cleanUp(45000);