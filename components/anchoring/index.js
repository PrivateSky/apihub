const anchoringStrategies = require("./strategies");

function requestStrategyMiddleware(request, response, next) {
    const receivedDomain = require("./utils").getDomainFromKeySSI(request.params.anchorId);
    const domainConfig = require("./utils").getAnchoringDomainConfig(receivedDomain);
    if (!domainConfig) {
        const error = `[Anchoring] Domain '${receivedDomain}' not found`;
        console.error(error);
        return response.send(500, error);
    }

    const StrategyClass = anchoringStrategies[domainConfig.type];
    if (!StrategyClass) {
        const error = `[Anchoring] Strategy for anchoring domain '${domainConfig.type}' not found`;
        console.error(error);
        return response.send(500, error);
    }

    try {
        request.strategy = new StrategyClass(request.server, domainConfig, request.params.anchorId, request.body);
    } catch (e) {
        console.error(error);
        return response.send(500, 'Unable to initialize anchoring strategy')
    }

    next();
}

function Anchoring(server) {
    function requestServerMiddleware(request, response, next) {
        request.server = server;
        next();
    }

    const { createAnchor, appendToAnchor, getAllVersions, publishHandler } = require("./controllers");

    const { responseModifierMiddleware, requestBodyJSONMiddleware } = require("../../utils/middlewares");

    server.use(`/anchor/:domain/*`, requestServerMiddleware);
    server.use(`/anchor/:domain/*`, responseModifierMiddleware);

    server.put(`/anchor/:domain/create-anchor/:anchorId`, requestBodyJSONMiddleware);
    server.put(`/anchor/:domain/create-anchor/:anchorId`, requestStrategyMiddleware);
    server.put(`/anchor/:domain/create-anchor/:anchorId`, createAnchor); // to do : add call in brickledger to store the trasantion call

    server.put(`/anchor/:domain/append-to-anchor/:anchorId`, requestBodyJSONMiddleware);
    server.put(`/anchor/:domain/append-to-anchor/:anchorId`, requestStrategyMiddleware);
    server.put(`/anchor/:domain/append-to-anchor/:anchorId`, appendToAnchor); // to do : add call in brickledger to store the trasantion call

    server.get(`/anchor/:domain/get-all-versions/:anchorId`, requestStrategyMiddleware);
    server.get(`/anchor/:domain/get-all-versions/:anchorId`, getAllVersions);

    server.get(`/anchor/:domain/subscribe/:keyssi`, publishHandler);

    server.delete(`/anchor/:domain/subscribe/:keyssi`, (request, response, next) => {
        // delete ANCHOR ?subscribeId=
    });
}

module.exports = Anchoring;
