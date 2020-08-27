function AnchorSubrscriptions(server) {
    const { URL_PREFIX } = require('./../constants');
    const { publishHandler } = require('./controllers');

    server.get(`${URL_PREFIX}/subscribe/:anchorId`, publishHandler);

    server.delete(`${URL_PREFIX}/subscribe/:anchorId`, (request, response, next) => {
        // delete ANCHOR ?subscribeId=
    });
}

module.exports = AnchorSubrscriptions;
