const Client = require('./libs/http-wrapper').Client;

const client = new Client();

client.get('http://127.0.0.1:8080/test', function (res) {

    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
    res.on('end', () => {
        console.log('No more data in response.');
    });
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
    console.log(res.body, ' !important');
});

client.post('http://127.0.0.1:8080/test', {x: 5}, function (res) {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
    res.on('end', () => {
        console.log('No more data in response.');
    });
});
