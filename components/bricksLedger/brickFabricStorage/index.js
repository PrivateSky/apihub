
function BrickFabricStorage(server) {
  const { URL_PREFIX } = require('./constants');
  const { brickFabricStorageService } = require('./services');

  server.put(`${URL_PREFIX}/bfs/storeCommand`, async (request, response, next) => {
    await brickFabricStorageService(request.body.command, request.body.body, {});

    response.send(204, null, next);
  });
}

module.exports = BrickFabricStorage;
