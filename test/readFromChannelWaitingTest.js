/**
 * Code that tests the blocking property of the GET request for messages
 */
const Client = require('../libs/http-wrapper').Client;
let httpUtils = require('../libs/http-wrapper').httpUtils;
const CrlServer = require('../CrlServer');
const cleanUp = require('./testCleanUp');

new CrlServer();
let client1 = new Client();
let client2 = new Client();

let config = {
    'endpoint': 'http://localhost:8080/channels'
};

client1.post(config.endpoint, {}, function (response) {
    if (response.statusCode === 200) {
        console.log('client1: ', `Created channel`);
    }
    httpUtils.setDataHandler(response, function (error, channelUid) {
        if (error) {
            console.error(error);
        } else {
            console.log('client1: ', `Got channel with UID ${channelUid}`);
            console.log('client1: ', `GET on ${config.endpoint}/${channelUid}/msg`);
            console.log('client1: ', 'Should wait 5 seconds ...');
            client1.get(`${config.endpoint}/${channelUid}/msg`, function (response) {
                if (response.statusCode === 200) {
                    console.log('client1: ', 'Successful GET response after 5 seconds');
                }
                httpUtils.setDataHandler(response, function (error, body) {
                    if (error) {
                        console.error(error);
                    } else {
                        const responseBody = JSON.parse(body);
                        console.log('client1: ', `READ message: ${responseBody.content}`);
                        console.log('client1: ', `Deleting consumed message ${responseBody.id}`);
                        client1.delete(`${config.endpoint}/${channelUid}/msg/${responseBody.id}`, function (response) {
                            if (response.statusCode === 200) {
                                console.log('client1: ', `Deleted message with id ${responseBody.id} from Message Queue`);
                            }
                        });
                    }
                });
            });
        }

        setTimeout(function () {
            const messageContent = {
                'message': 'hello world',
                'type': 'string'
            };
            const requestConfig = {
                body: messageContent
            };
            console.log('client2: ', `Writing message in ${channelUid}`);
            client2.post(`${config.endpoint}/${channelUid}`, requestConfig, function (response) {
                if (response.statusCode === 200) {
                    console.log('client2: ', `Wrote message in ${channelUid}`);
                }
            });
            setTimeout(function () {
                cleanUp('channels');
            }, 1000);
        }, 5000);
    })
});
