

function BrickFabricStorage(server) {
    const { responseModifierMiddleware, requestBodyJSONMiddleware } = require('../../../utils/middlewares');
    const { brickFabricStorageService } = require('./services');

    server.put('/bricks-ledger/bfs/storeCommand', responseModifierMiddleware);
    server.put('/bricks-ledger/bfs/storeCommand', requestBodyJSONMiddleware);
    server.put('/bricks-ledger/bfs/storeCommand', async (request, response, next) => {
      await  brickFabricStorageService(request.body.command, request.body.body, {});
      
      response.send(204, null, next);
    });
}

module.exports = BrickFabricStorage;
