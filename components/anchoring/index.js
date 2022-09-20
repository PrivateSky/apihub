
function Anchoring(server) {
    function requestServerMiddleware(request, response, next) {
        request.server = server;
        next();
    }

    const {
        createAnchor,
        appendToAnchor,
        createOrUpdateMultipleAnchors,
        getAllVersions,
        getLastVersion,
        totalNumberOfAnchors,
        dumpAnchors
    } = require("./controllers");

    const {responseModifierMiddleware, requestBodyJSONMiddleware} = require("../../utils/middlewares");
    const {getEthereumSyncServiceSingleton} = require("./strategies/oba/ethereumSyncService");

    const ethSyncService = getEthereumSyncServiceSingleton(server);
    ethSyncService.synchronize();

    server.use(`/anchor/:domain/*`, requestServerMiddleware);
    server.use(`/anchor/:domain/*`, responseModifierMiddleware);

    server.put(`/anchor/:domain/create-anchor/:anchorId`, requestBodyJSONMiddleware);
    server.put(`/anchor/:domain/create-anchor/:anchorId/:anchorValue`, createAnchor);

    server.put(`/anchor/:domain/append-to-anchor/:anchorId`, requestBodyJSONMiddleware);
    server.put(`/anchor/:domain/append-to-anchor/:anchorId/:anchorValue`, appendToAnchor);

    server.put(`/anchor/:domain/create-or-update-multiple-anchors`, requestBodyJSONMiddleware);
    server.put(`/anchor/:domain/create-or-update-multiple-anchors`, createOrUpdateMultipleAnchors);

    server.get(`/anchor/:domain/get-all-versions/:anchorId`, getAllVersions);

    server.get(`/anchor/:domain/get-last-version/:anchorId`, getLastVersion);
}

module.exports = Anchoring;
