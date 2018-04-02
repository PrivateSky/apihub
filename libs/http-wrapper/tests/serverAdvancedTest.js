const Server = require('../src/classes/Server');
const Client = require('../src/classes/Client');

/* SERVER */

const server = new Server().listen(8080);

server.use(function (req, res, next) {
    req.testMiddleware = 'worked';
    console.log('Middleware for all requests');
    next();
});

server.use('/test/:id', function (req, res, next) {
    console.log(`Middleware for route: /test/${req.params.id}`);
    next();
});

server.use('/test/id', function () {
    console.warn('This middleware should not trigger');
});

// server.use('GET', '/test/:id', function (req, res, next) {
//     console.log(`Middleware for route: /test/${req.params.id} and method GET`);
//     next();
// });
//
// server.use('POST', '/test/:id', function () {
//     console.warn('Middleware for route: /test/:id and method POST should not be triggered');
// });

server.get('/test/:id', function (req, res) {
    console.log('Request resolver');
    console.log(req.params);
    console.log(req.testMiddleware);
    res.end('works');
});

server.post('/test2/:id', function(req, res) {
    res.end('post end');
});

server.use(function(req, res) {
    res.end('404');
});


/* CLIENT */

const client = new Client();

client.get('http://127.0.0.1:8080/test/123', function(res) {
   res.on('data', function(data) {
       console.log(`client: ${data}`);
   });
});

client.post('http://127.0.0.1:8080/test2/123', {}, function(res) {
   res.on('data', function(data) {
       console.log(`clinet post response: ${data}`);
   })
});
