function AnchorSubscribe(server) {
    const { publishHandler } = require('./controllers');

    server.get(`/anchor/:domain/subscribe/:keyssi`, publishHandler);

    server.delete(`/anchor/:domain/subscribe/:keyssi`, (request, response, next) => {
        // delete ANCHOR ?subscribeId=
    });
    
}

module.exports = AnchorSubscribe;
