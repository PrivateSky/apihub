function Bricks(server) {
    require('./flows/BricksManager');

    const {headersMiddleware, responseModifierMiddleware} = require('../../utils/middlewares');
    const {createHandlerDownloadBrick, createHandlerDownloadMultipleBricks, createHandlerUploadBrick} = require('./controllers');
    const uploadBrick = createHandlerUploadBrick(server);
    const downloadBrick = createHandlerDownloadBrick(server);
    const downloadMultipleBricks = createHandlerDownloadMultipleBricks(server);

    server.use(`/bricks/:domain/*`, headersMiddleware);
    server.use(`/bricks/:domain/*`, responseModifierMiddleware);

    //call brick based on domain. Similar with Anchoring. if is not filled, it will fallback to 'default' domain
    server.put(`/bricks/:domain/put-brick`, uploadBrick);
    server.put(`/bricks/:domain/put-brick/:domain`, uploadBrick);

    server.get(`/bricks/:domain/get-brick/:hashLink`, downloadBrick);
    server.get(`/bricks/:domain/downloadMultipleBricks`, downloadMultipleBricks);

    server.get(`/bricks/:domain/get-brick/:hashLink/:domain`, downloadBrick);
    server.get(`/bricks/:domain/downloadMultipleBricks/:domain`, downloadMultipleBricks);
}

module.exports = Bricks;
