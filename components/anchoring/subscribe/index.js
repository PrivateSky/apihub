function AnchorSubrscribe(server) {
    const { URL_PREFIX } = require('../constants');
    const { publishHandler } = require('./controllers');

    server.get(`${URL_PREFIX}/subscribe/:keyssi`, publishHandler);

    server.delete(`${URL_PREFIX}/subscribe/:keyssi`, (request, response, next) => {
        // delete ANCHOR ?subscribeId=
    });
    
}

module.exports = AnchorSubrscribe;
