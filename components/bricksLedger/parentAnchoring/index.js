const anchoringService = require('./services');

function ParentAnchoring(server) {
    server.put('/bricks-ledger/pas/anchor/:hashLink', (request, response, next) => {
        await anchoringService.addAnchor(hashLink).catch(err=> response.send(400, err.message || 'Something went wrong'));
        
        next();
    });
}

module.exports = ParentAnchoring;
