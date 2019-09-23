/** Basic test that focuses on the POST request and the number of posted messages corresponding 
 * to the expected result*/

const utils = require("../Utils/virtualMQUtils");
const msg = require("modules/virtualmq/tests/oldies/russianText");
const assert = require("double-check").assert;
var countMsg = 0;
var index = 0;
var numberOfCallbacks = 50;
finishCallback = null;

var postCallback = function () {

    if (index == numberOfCallbacks) {
        return;
    }
    setTimeout(() => {
        utils.httpRequest(utils.createSwarmMessage(msg.testText + ' index' + index), postCallback);
        utils.httpRequest(null, verify, 'GET');
        index++;
    }, index == 1  ? 5000 : 100 );


};

var verify = function(data){
    var expected = utils.createSwarmMessage(msg.testText + ' index' + countMsg);
    countMsg++;
     console.log("Got message", data);
     console.log("Expected message ", expected);
     assert.equal(expected, data, "Did not receive the right message back");

    if (countMsg == numberOfCallbacks) {
        clearInterval(getMessageInterval);
        finishCallback();
        process.exit(0);
    }
};
var getMessageInterval;
function test(finish) {
    finishCallback = finish;
    utils.createServer((server) => {
        postCallback();
       /* setTimeout(()=>{
            index = 0;
             getMessageInterval = setInterval(()=> {
                utils.httpRequest(null, verify, 'GET');
            },100);
        }, 15000);*/
    });
}

utils.initVirtualMQ();
assert.callback("VirtualMQ POST & GET russian text", test, 20000);
//delete creted test folder
utils.cleanUp(20500);