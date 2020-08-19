
function WorldStateManagerStrategy(server) {
    const commandDispatcher = require('./controllers');

	server.put('/bricks-ledger/wsms/command', commandDispatcher);
}

module.exports = WorldStateManagerStrategy;
