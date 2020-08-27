const makeRequest = require('../../../utils').requests;
const config= require('../../../config');

const { brickFabricStorageService } = require('../brickFabricStorage/services');

async function commandDispatcher(request, response, next) {
    const queryParams = getQueryParam(request.url);
    const command = config.getConfig('endpointsConfig', 'bricksLedger', 'commands', queryParams.type);

    if (invalidCommand(command)) {
        return response.send(400, 'Bad request. Invalid config', () => response.end());
    }

    let commandResponse;

    if (command.url) {
        commandResponse = await makeRequest(command.url, 'POST', request.body).catch((err) => {
            return response.send(err.statusCode || 400, err.body || 'Bad request', () => response.end())
        });
    } else if (command.module) {
        let module;

        try {
            module = require(command.module);
        } catch (err) {
            return response.send(400, 'Module not found', () => response.end());
        }

        commandResponse = {
            statusCode: 200,
            body: command.function ? module[command.function]() : module()
        };
    }

    response.send(commandResponse.statusCode, commandResponse.body);
    await brickFabricStorageService(queryParams.type, request.body, commandResponse.body);

    next();
}

function getQueryParam(path) {
    const query = path.split('?');

    if (query.length === 1) {
        return {}
    }

    return query[1].split('&').reduce((acc, current) => {
        const [key, value] = current.split('=');
        acc[key] = value;

        return acc;
    }, {})
}

function invalidCommand(command) {
    const regex = /^(?:http(s)?:\/\/)((:[\d]+)?)[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+$/gm;

    return !command || !Object.keys(command).length || (command.url && !regex.test(command.url))
}

module.exports = commandDispatcher;
