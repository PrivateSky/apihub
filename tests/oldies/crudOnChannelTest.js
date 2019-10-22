const Client = require('../../libs/http-wrapper/src').Client;
const httpUtils = require('../../libs/http-wrapper/src').httpUtils;
const CrlServer = require('../CrlServer');
const cleanUp = require('./testCleanUp');

new CrlServer();
let client1 = new Client();
let client2 = new Client();

let config = {
    'endpoint': 'http://localhost:8080/channels'
};

function deleteMessage(client, channelUid, responseBody) {
    client.delete(`${config.endpoint}/${channelUid}/msg/${responseBody.id}`, function (response) {
        if (response.statusCode === 200) {
            console.log('client1: ', `Deleted message with id ${responseBody.id} from Message Queue`);
        }
        cleanUp('channels');
    });
}

function getMessage(client, channelUid) {
    client.get(`${config.endpoint}/${channelUid}/msg`, function (response) {
        if (response.statusCode !== 200) {
            console.error(response.statusMessage);
        } else {
            console.log('client1: ', `GET on ${config.endpoint}/${channelUid}/msg`);
            console.log('client1: ', 'Waiting...');
            httpUtils.setDataHandler(response, function (error, body) {
                if (error) {
                    console.error(error);
                } else {
                    const responseBody = JSON.parse(body);
                    console.log('client1: ', `READ message: ${responseBody.content}`);
                    console.log('client1: ', `Deleting consumed message ${responseBody.id}`);
                    deleteMessage(client, channelUid, responseBody);
                }
            });
        }
    });
}

function sendMessage(client, channelUid) {
    const messageContent = {
        'message': 'hello world',
        'type': 'string'
    };
    const requestConfig = {
        body: messageContent,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    client.post(`${config.endpoint}/${channelUid}`, requestConfig, function (response) {
        if (response.statusCode !== 201) {
            console.error(console.error(response.statusMessage));
        } else {
            console.log('client2: ', `Wrote message in ${channelUid}`);
        }
    });
}

client1.post(config.endpoint, {}, function (response) {
    if (response.statusCode === 200) {
        console.log('client1: ', `Created channel`);
    }
    httpUtils.setDataHandler(response, function (error, channelUid) {
        if (error) {
            console.error(error);
        } else {
            console.log('client1: ', `Got channel with UID ${channelUid}`);
            getMessage(client1, channelUid);
            console.log('client2: ', `Writing message in ${channelUid}`);
            sendMessage(client2, channelUid);
        }
    });
});
