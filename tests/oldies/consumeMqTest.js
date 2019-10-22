/* This test aims to test if deletion of all the messages in a queue is working properly */


const utils = require("../Utils/virtualMQUtils");
const assert = require("double-check").assert;

var index = 0;
var nrOfDeletions = 0;
var msgArr = ['msg_1', 'msg_2', 'msg_3', 'msg_4', 'msg_5'];
var numberOfMessages = msgArr.length;
var intervalId = null, finishCallback;


let postCallback = function () {
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


let deleteMessageCallback = function (data) {
    nrOfDeletions++;
    if (nrOfDeletions == index) {
        clearInterval(intervalId);
        assert.equal(nrOfDeletions, msgArr.length, "Queue is not empty");
        finishCallback();
        utils.deleteFolder(folder);
        process.exit(0);
    }
};

// Make a delete request
function deleteMessage(msgId) {
    let options = utils.getRequestOptions('DELETE', '/' + msgId);
    try {
        utils.httpRequest(msgId, deleteMessageCallback, 'DELETE', options);
    } catch (e) {
        console.log(' in catch error form delete');
    }
}

let getMessageIdCallback = function (data) {
    deleteMessage(JSON.parse(data).confirmationId);
};

function deleteMessageFromMQ(finish) {
    let options = utils.getRequestOptions('GET', '?waitConfirmation=true');
    utils.httpRequest(null, getMessageIdCallback, 'GET', options);
}

function test(finish) {

    finishCallback = finish;
    utils.createServer((server) => {
        utils.httpRequest(utils.createSwarmMessage(msgArr[index]), postCallback);

        //delete first message from queue
        setTimeout(() => {
            intervalId = setInterval(() => {
                deleteMessageFromMQ(finish);
            }, 500);
        }, 7000);
    });
}


utils.initVirtualMQ();
assert.callback("VirtualMQ GET request test", test, 25000);
//delete creted test folder
utils.cleanUp(25000 + 3000);