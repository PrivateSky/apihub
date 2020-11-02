function BricksLedger(server) {

    const executeCommand= require('./controlers')(server);
    const { URL_PREFIX } = require('./constants');
    const { responseModifierMiddleware, requestBodyJSONMiddleware } = require('../../utils/middlewares');

    server.use(`${URL_PREFIX}/*`, responseModifierMiddleware);

    server.post(`${URL_PREFIX}/runCommand`, requestBodyJSONMiddleware);
    server.post(`${URL_PREFIX}/runCommand`, executeCommand);

    console.log(`listening on ${URL_PREFIX}/runCommand`)
}


module.exports = BricksLedger;