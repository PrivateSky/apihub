const {ALIAS_SYNC_ERR_CODE} = require("../utils");
const utils = require("../utils");
const anchoringStrategies = require("../strategies");
const logger = $$.getLogger("controllers", "apihub/anchoring");
const getStrategy = async (request) => {
    let receivedDomain;
    let domainConfig;
    if (request.params.anchorId && request.params.domain) {
        try {
            receivedDomain = utils.getDomainFromKeySSI(request.params.anchorId);
        } catch (e) {
            throw Error(`[Anchoring] Unable to parse anchor id`);
        }

        if (receivedDomain !== request.params.domain) {
            throw Error(`[Anchoring] Domain mismatch: '${receivedDomain}' != '${request.params.domain}'`);
        }

        domainConfig = await utils.getAnchoringDomainConfig(receivedDomain);
        if (!domainConfig) {
            throw Error(`[Anchoring] Domain '${receivedDomain}' not found`);
        }
    }

    const StrategyClass = anchoringStrategies[domainConfig.type];
    if (!StrategyClass) {
        throw Error(`[Anchoring] Strategy for anchoring domain '${domainConfig.type}' not found`);
    }

    let strategy;
    try {
        strategy = new StrategyClass(request.server, domainConfig, request.params.anchorId, request.params.anchorValue, request.body);
    } catch (e) {
        throw Error(`[Anchoring] Unable to initialize anchoring strategy`);
    }

    return strategy;
}

function getWritingHandler(response) {
    return (err) => {
        if (err) {
            const errorMessage = typeof err === "string" ? err : err.message;
            if (err.code === "EACCES") {
                return response.send(409, errorMessage);
            } else if (err.code === ALIAS_SYNC_ERR_CODE) {
                // see: https://tools.ietf.org/html/rfc6585#section-3
                return response.send(428, errorMessage);
            } else if (err.code === 403) {
                return response.send(403, errorMessage);
            }
            logger.error(err);
            return response.send(500, errorMessage);
        }

        response.send(201);
    };
}

async function updateAnchor(action, request, response) {
    let strategy;
    try {
        strategy = await getStrategy(request);
    } catch (e) {
        logger.error(e);
        return response.send(500, e);
    }
    strategy[action](getWritingHandler(response));
}


function getReadingHandler(response) {
    return (err, result) => {
        if (err) {
            return response.send(404, "Anchor not found");
        }

        if (!result) {
            return response.send(200, null);
        }

        if (typeof result === "object") {
            response.setHeader("Content-Type", "application/json");
        }

        response.send(200, result);
    }
}

async function readDataForAnchor(action, request, response) {
    let strategy;
    try {
        strategy = await getStrategy(request);
    } catch (e) {
        logger.error(e);
        return response.send(500, e);
    }
    strategy[action](getReadingHandler(response));
}


function createAnchor(request, response) {
    updateAnchor("createAnchor", request, response);
}

function appendToAnchor(request, response) {
    updateAnchor("appendAnchor", request, response);
}

function createOrUpdateMultipleAnchors(request, response) {
    updateAnchor("createOrUpdateMultipleAnchors", request, response);
}

function getAllVersions(request, response) {
    readDataForAnchor("getAllVersions", request, response);
}

function getLastVersion(request, response) {
    readDataForAnchor("getLastVersion", request, response);
}

function totalNumberOfAnchors(request, response) {
    readDataForAnchor("totalNumberOfAnchors", request, response);
}

function dumpAnchors(request, response) {
    readDataForAnchor("dumpAnchors", request, response);
}


module.exports = {
    createAnchor,
    appendToAnchor,
    createOrUpdateMultipleAnchors,
    getAllVersions,
    getLastVersion,
    totalNumberOfAnchors,
    dumpAnchors
};
