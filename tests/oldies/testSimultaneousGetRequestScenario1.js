/*
* Test for simultaneous GET calls. Expected result is that number of GET requests should be equal to POST requests.
* Calling more GET's then POST's as fast as possible
* */
const utils = require("../Utils/virtualMQUtils");
const assert = require("double-check").assert;

var countMessages = 0, postIndex = 0, getIndex = 0, postInterval, getInterval, nrOfPostRequests = 10,
    nrOfGetRequests = 20;
var timeoutForPost = 1000; //one sec to post a message should be ok
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

    //first call to create folder structure
    utils.httpRequest(utils.createSwarmMessage('testMessage_' + 0), onPostEnd);

    //wait for folder structure, after send a bunch of POST requests
    setTimeout(() => {
        postInterval = setInterval(() => {
            let msg = 'testMessage_' + postIndex;
            utils.httpRequest(utils.createSwarmMessage(msg), onPostEnd);
            console.log('++++++++++++++++++++', msg);
        }, timeoutForPost);
    }, timeoutForFolderStructure);

    //wait for all posts do finish and start to consume/get from queue very fast
    setTimeout(() => {
        getInterval = setInterval(() => {
            utils.httpRequest(null, onGetEnd, 'GET');
            //getMessage();
        }, 1);
    }, timeoutForFolderStructure + timeoutForPost * nrOfPostRequests);

    //wait for all post and get calls to finish
    setTimeout(() => {
        assert.true(countMessages == nrOfPostRequests, "Wrong number of get messages. Expected " + nrOfPostRequests + " found " + countMessages);
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