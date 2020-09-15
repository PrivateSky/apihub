
function Anchoring(server) {
    require('./flows/AnchorsManager');

    const fs = require('fs');
    const path = require("swarmutils").path;
    const { URL_PREFIX } = require('./constants');
    const AnchorSubrscribe = require('./subscribe');
    const AnchorVersions = require('./versions');
    const { addAnchor } = require('./controllers');
    const { responseModifierMiddleware, requestBodyJSONMiddleware } = require('../../utils/middlewares');

    const storageFolder = path.join(server.rootFolder, 'anchors');
    let storageNotAccessible = false;

    try {
        fs.mkdirSync(storageFolder, { recursive: true });
    } catch {
        storageNotAccessible = true;
    }

    $$.flow.start('AnchorsManager').init(storageFolder);

    server.use(`${URL_PREFIX}/*`, responseModifierMiddleware);
    server.put(`${URL_PREFIX}/add/:fileId`, requestBodyJSONMiddleware);
    server.put(`${URL_PREFIX}/add/:fileId`, addAnchor);

    AnchorVersions(server);
    AnchorSubrscribe(server);
}

module.exports = Anchoring;
