const { URL_PREFIX } = require('./../constants');

function Anchoring(server) {
    const AnchorSubrscriptions = require('./subscriptions');
    const { addAnchor } = require('./controllers');
    const { responseModifierMiddleware } = require('../../utils/middlewares');

    const storageFolder = path.join(server.rootFolder, 'anchors');
    let storageNotAccessible = false;

    try {
        fs.mkdirSync(storageFolder, { recursive: true });
    } catch {
        storageNotAccessible = true;
    }

    $$.flow.start("AnchorsManager").init(storageFolder);


    server.use(`${URL_PREFIX}/*`, responseModifierMiddleware);

    // if the method is POST why add additinal verb do describe action
    server.post(`${URL_PREFIX}`, addAnchor);

    AnchorSubrscriptions(server);
}

module.exports = Anchoring;
