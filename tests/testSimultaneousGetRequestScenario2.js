/*
* Test for simultaneous GET calls. Expected result is that number of GET requests should be equal to POST requests.
* Calling more GET's then POST's as fast as possible
* */
const utils = require("../Utils/virtualMQUtils");
const assert = require("double-check").assert;

var countMessages = 0, postIndex = 0, getIndex = 0, postInterval, getInterval, nrOfPostRequests = 1,
    nrOfGetRequests = 10;
var timeoutForPost = 1000, timeoutForGet = 1000; //one sec to post a message should be ok
var timeoutForFolderStructure = 5000;

var onPostEnd = function (data) {
    postIndex++;
    console.log('posting data', data);
    if (postIndex >= nrOfPostRequests) {
        clearInterval(postInterval);
    }
};
var onGetEnd = function (data) {
    console.log('read data ', data);
    getIndex++;
    if (data) {
        countMessages++;
    }
    if (getIndex >= nrOfGetRequests) {
        clearInterval(getInterval);
    }
};

function testPostGetSync(finish) {

    for (let i = 0; i < nrOfGetRequests; i++) {
        utils.httpRequest(null, onGetEnd, 'GET');
    }

    //wait for folder GET requests to finish, after send a bunch of POST requests
    setTimeout(() => {
       // utils.httpRequest(utils.createSwarmMessage('testMessage_'), onPostEnd);
        postInterval = setInterval(() => {
            let msg = 'testMessage_' + postIndex;
            utils.httpRequest(utils.createSwarmMessage(msg), onPostEnd);
            console.log('++++++++++++++++++++', msg);
        }, 100);
    }, timeoutForGet * nrOfGetRequests + 2000);


    //wait for all post and get calls to finish
    setTimeout(() => {
        assert.true(countMessages == postIndex, "Wrong number of get messages. Expected " + postIndex + " found " + countMessages);
        utils.deleteFolder(folder);
        finish();
        process.exit(0);
    }, timeoutForFolderStructure + timeoutForPost * nrOfPostRequests + 10000);
}

utils.initVirtualMQ();
utils.createServer((server) => {
    assert.callback("VirtualMQ GET request test", testPostGetSync, 60000 + 5000);

});
//delete creted test folder
utils.cleanUp(60000 + 7000);