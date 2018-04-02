const Client = require('../src/classes/Client');

let client = new Client();

client.get('127.0.0.1:8080/test', function(res, body) {

});

client.request('get', '127.0.0.1:8080/test', function(res, body) {

});

client.post('127.0.0.1:8080/test', {}, function(res, body) {

});
