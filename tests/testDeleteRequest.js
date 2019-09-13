/* This test aims to test if deletion of the first message from a queue is working properly */


const utils = require("../Utils/virtualMQUtils");
const assert = require("double-check").assert;

var index = 0;

var msgArr = ['msg_1', 'msg_2', 'msg_3', 'msg_4', 'msg_5'];
var countMsg = 1;
var finishCallback;

// Make a post with a message

var postMessageCallback = function () {
    //console.log("Post message", message, new Date().getTime());
    index++;
    if(index == msgArr.length){
        return;
    }
    if(index==1){
        console.log('-------- just wait for file structure to be created --------');
        setTimeout(()=>{
            utils.httpRequest(utils.createSwarmMessage(msgArr[index]), postMessageCallback);
        }, 5000);
    }
    else{
        utils.httpRequest(utils.createSwarmMessage(msgArr[index]), postMessageCallback);
    }
};

var getMessageCallback = function (data) {
    var expected = utils.createSwarmMessage(msgArr[countMsg]);
    countMsg++;
    console.log("Got message", data);
    console.log("Expected message ", expected);
    assert.equal(expected, data, "Did not receive the right message back");
    assert.true(countMsg<=msgArr.length, "Number of messages is wrong");
    if (countMsg == msgArr.length) {
        utils.deleteFolder(folder);
        finishCallback();
        process.exit(0);
    }
};

var getMessageIdCallback = function (data) {
    deleteMessage(JSON.parse(data).confirmationId);
};
var deleteMessageCallback = function(data){
    console.log("Delete first message from MQ");
};

// Make a delete request
function deleteMessage(msgId) {
    let options = utils.getRequestOptions('DELETE', '/'+ msgId);
    utils.httpRequest(msgId, deleteMessageCallback, 'DELETE', options);
}

function test(finish) {
    finishCallback = finish;
    utils.createServer((server) => {

        //post messages in mq
        utils.httpRequest(utils.createSwarmMessage(msgArr[index]), postMessageCallback);

        //delete first message from queue
        setTimeout(()=>{
            //deleteMessageFromMQ();
            let options = utils.getRequestOptions('GET','?waitConfirmation=true');
            utils.httpRequest(null, getMessageIdCallback, 'GET',options);
        }, 7000);

        setTimeout(()=>{
            setInterval(()=> {
                //getMessageFromQueue(finish)
                utils.httpRequest(null, getMessageCallback, 'GET');
            },100);
        }, 10000);


    });

}

utils.initVirtualMQ();
assert.callback("VirtualMQ GET request test", test, 25000);
//delete creted test folder
utils.cleanUp(25000 + 3000);
