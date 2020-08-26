
function Bricks(server) {
    require('../../flows/BricksManager');
    
    const path = require('path');
    const bricks_storage_folder = 'brick-storage';
    const { URL_PREFIX } = require('./constants');
    const { headersMiddleware, responseModifierMiddleware } = require('../../utils/middlewares');
    const { downloadBrick, downloadMultipleBricks, uploadBrick } = require('./controllers');

    let storageFolder = path.join(server.rootFolder, bricks_storage_folder);

    if (typeof process.env.EDFS_BRICK_STORAGE_FOLDER !== 'undefined') {
        storageFolder = process.env.EDFS_BRICK_STORAGE_FOLDER;
    }

    $$.flow.start('BricksManager').init(storageFolder);
    console.log('Bricks Storage location', storageFolder);

    server.use(`${URL_PREFIX}/*`, headersMiddleware);
    server.use(`${URL_PREFIX}/*`, responseModifierMiddleware);
    server.use(`${URL_PREFIX}/downloadMultipleBricks`, downloadMultipleBricks);

    server.put(`${URL_PREFIX}`, uploadBrick);
    server.get(`${URL_PREFIX}/:hashLink`, downloadBrick);
}

module.exports = Bricks;
