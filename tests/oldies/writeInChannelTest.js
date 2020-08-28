const fs = require('fs');
const path = require('swarmutils').path;
const Client = require('../../libs/http-wrapper/src').Client;
const httpUtils = require('../../libs/http-wrapper/src').httpUtils;
const CrlServer = require('../CrlServer');
const cleanUp = require('./testCleanUp');

new CrlServer();
let client = new Client();

const testConfig = {
    endpoint: 'http://127.0.0.1:8080/channels',
    channelUid: 123,
    testBody: {
        "ip": "127.0.0.1",
        "port": 2354,
        "uid": 222222
    }
};

const config = {
    body: testConfig.testBody
};

client.post(`${testConfig.endpoint}/${testConfig.channelUid}`, config, function (response) {
    httpUtils.setDataHandler(response, function (error, messageUid) {
        if (error) {
            console.error(error);
        } else {
            console.log(response.statusCode);
            console.log(messageUid);
            const createdChannelPath = `channels/${testConfig.channelUid}`;
            const postedMessagePath = path.join(createdChannelPath, messageUid);
            if (fs.existsSync(postedMessagePath)) {
                console.log('Test Passed');
            } else {
                console.log('Test Failed');
            }
            cleanUp('channels');
        }
    });
});
