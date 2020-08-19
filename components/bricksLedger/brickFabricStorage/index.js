
function BrickFabricStorage(server) {
    const { brickFabricStorageService } = require('./services');

    server.put('/bricks-ledger/bfs/storeCommand', async (request, response, next) => {
      await  brickFabricStorageService(request.body.command, request.body.body, {});
      
      response.send(204, null, next);
    });
}

module.exports = BrickFabricStorage;
