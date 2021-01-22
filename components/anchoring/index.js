


function Anchoring(server) {

    require('./strategies/FS');
    require('./strategies/ETH');

    const AnchorSubscribe = require('./subscribe');
    const AnchorVersions = require('./versions');
    const  addAnchor = require('./controllers')(server);
    const { responseModifierMiddleware, requestBodyJSONMiddleware } = require('../../utils/middlewares');

    server.use(`/anchor/:domain/*`, responseModifierMiddleware);
    server.put(`/anchor/:domain/add/:anchorId`, requestBodyJSONMiddleware);
    server.put(`/anchor/:domain/add/:anchorId`, addAnchor); // to do : add call in brickledger to store the trasantion call

    AnchorVersions(server);
    AnchorSubscribe(server);
}

module.exports = Anchoring;
