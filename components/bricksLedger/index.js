

function BricksLedger(server) {

console.log('init BricksLedger');

    console.log('SERVER protocollllll',server.protocol());

    const {executeCommand} = require('./controlers');
    const { URL_PREFIX } = require('./constants');
    const { responseModifierMiddleware, requestBodyJSONMiddleware } = require('../../utils/middlewares');

    server.use(`${URL_PREFIX}/*`, responseModifierMiddleware);

    server.post(`${URL_PREFIX}/runCommand`, requestBodyJSONMiddleware);
    server.post(`${URL_PREFIX}/runCommand`, executeCommand);

    console.log(`listening on ${URL_PREFIX}/runCommand`)
}


module.exports = BricksLedger;