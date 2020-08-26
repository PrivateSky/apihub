
function ParentAnchoring(server) {
    const { URL_PREFIX } = require('./../constants');
    const anchoringService = require('./services');
    
    server.put(`${URL_PREFIX}/pas/anchor/:hashLink`, async (request, response, next) => {
        await anchoringService.addAnchor(hashLink).catch((err) => response.send(400, err.message || 'Something went wrong'));

        next();
    });
}

module.exports = ParentAnchoring;
