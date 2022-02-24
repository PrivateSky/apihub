const anchoringStrategies = require("./strategies");
const utils = require('./utils');

function requestStrategyMiddleware(request, response, next) {
    let receivedDomain;

    try {
        receivedDomain = utils.getDomainFromKeySSI(request.params.anchorId);
    } catch (e) {
        const error = `[Anchoring] Unable to parse anchor id`;
        console.error(error)
        return response.send(500, error);
    }

    if (receivedDomain !== request.params.domain) {
        const error = `[Anchoring] Domain mismatch: '${receivedDomain}' != '${request.params.domain}'`;
        console.error(error);
        return response.send(403, error);
    }

    const domainConfig = utils.getAnchoringDomainConfig(receivedDomain);
    if (!domainConfig) {
        const error = `[Anchoring] Domain '${receivedDomain}' not found`;
        console.error(error);
        return response.send(404, error);
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
        const error = `[Anchoring] Unable to initialize anchoring strategy`;
        console.error(error);
        console.error(e);
        return response.send(500, error);
    }

    next();
}

function Anchoring(server) {
    function requestServerMiddleware(request, response, next) {
        request.server = server;
        next();
    }

    const { createAnchor, appendToAnchor, getAllVersions, getLastVersion } = require("./controllers");

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

    server.get(`/anchor/:domain/get-last-version/:anchorId`, requestStrategyMiddleware);
    server.get(`/anchor/:domain/get-last-version/:anchorId`, getLastVersion);

}

module.exports = Anchoring;
