function Bricks(server) {
    require('./flows/BricksManager');

    const {headersMiddleware, responseModifierMiddleware} = require('../../utils/middlewares');
    const {createHandlerDownloadBrick, createHandlerDownloadMultipleBricks, createHandlerUploadBrick} = require('./controllers');
    const uploadBrick = createHandlerUploadBrick(server);
    const downloadBrick = createHandlerDownloadBrick(server);
    const downloadMultipleBricks = createHandlerDownloadMultipleBricks(server);

    server.use(`/bricking/:domain/*`, headersMiddleware);
    server.use(`/bricking/:domain/*`, responseModifierMiddleware);

    //call brick based on domain. Similar with Anchoring. if is not filled, it will fallback to 'default' domain
    server.put(`/bricking/:domain/put-brick`, uploadBrick);
    server.put(`/bricking/:domain/put-brick/:domain`, uploadBrick);

    server.get(`/bricking/:domain/get-brick/:hashLink`, downloadBrick);
    server.get(`/bricking/:domain/downloadMultipleBricks`, downloadMultipleBricks);

    server.get(`/bricking/:domain/get-brick/:hashLink/:domain`, downloadBrick);
    server.get(`/bricking/:domain/downloadMultipleBricks/:domain`, downloadMultipleBricks);
}

module.exports = Bricks;
