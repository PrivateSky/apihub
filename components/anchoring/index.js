


function Anchoring(server) {

    require('./strategies/FS');


    const { URL_PREFIX } = require('./constants.js');
    const AnchorSubrscribe = require('./subscribe');
    const AnchorVersions = require('./versions');
    const  addAnchor = require('./controllers')(server);
    const { responseModifierMiddleware, requestBodyJSONMiddleware } = require('../../utils/middlewares');

    server.use(`${URL_PREFIX}/*`, responseModifierMiddleware);
    server.put(`${URL_PREFIX}/add/:keyssi`, requestBodyJSONMiddleware);
    server.put(`${URL_PREFIX}/add/:keyssi`, addAnchor); // to do : add call in brickledger to store the trasantion call

    AnchorVersions(server);
    AnchorSubrscribe(server);
}

module.exports = Anchoring;
