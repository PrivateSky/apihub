
function WorldStateManagerStrategy(server) {
    const { URL_PREFIX } = require('./../constants');
    const commandDispatcher = require('./controllers');

    server.put(`${URL_PREFIX}/wsms/command`, commandDispatcher);
}

module.exports = WorldStateManagerStrategy;
