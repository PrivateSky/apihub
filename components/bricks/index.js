function Bricks(server) {
    require('./flows/BricksManager');


    const {URL_PREFIX} = require('./constants');
    const {headersMiddleware, responseModifierMiddleware} = require('../../utils/middlewares');
    const {createHandlerDownloadBrick, createHandlerDownloadMultipleBricks, createHandlerUploadBrick} = require('./controllers');
    const uploadBrick = createHandlerUploadBrick(server);
    const downloadBrick = createHandlerDownloadBrick(server);
    const downloadMultipleBricks = createHandlerDownloadMultipleBricks(server);

    server.use(`${URL_PREFIX}/*`, headersMiddleware);
    server.use(`${URL_PREFIX}/*`, responseModifierMiddleware);

    //call brick based on domain. Similar with Anchoring. if is not filled, it will fallback to 'default' domain
    server.put(`${URL_PREFIX}/put-brick`, uploadBrick);
    server.put(`${URL_PREFIX}/put-brick/:domain`, uploadBrick);


    server.get(`${URL_PREFIX}/get-brick/:hashLink`, downloadBrick);
    server.get(`${URL_PREFIX}/downloadMultipleBricks`, downloadMultipleBricks);

    server.get(`${URL_PREFIX}/get-brick/:hashLink/:domain`, downloadBrick);
    server.get(`${URL_PREFIX}/downloadMultipleBricks/:domain`, downloadMultipleBricks);
}

module.exports = Bricks;
