function Bricks(server) {
    function requestServerMiddleware(request, response, next) {
        request.server = server;
        next();
    }

    const { headersMiddleware, responseModifierMiddleware } = require('../../utils/middlewares');

    const { requestFSBrickStorageMiddleware } = require('./middlewares');

    const { getBrick, putBrick, downloadMultipleBricks } = require('./controllers');

    server.use(`/bricking/:domain/*`, headersMiddleware);
    server.use(`/bricking/:domain/*`, responseModifierMiddleware);
    server.use(`/bricking/:domain/*`, requestServerMiddleware); // request.server
    server.use(`/bricking/:domain/*`, requestFSBrickStorageMiddleware); // request.fsBrickStorage

    server.put(`/bricking/:domain/put-brick`, putBrick);

    server.get(`/bricking/:domain/get-brick/:hashLink`, getBrick);

    server.get(`/bricking/:domain/downloadMultipleBricks`, downloadMultipleBricks);
}

module.exports = Bricks;
