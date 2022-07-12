function Iframe(server) {
    const { handleCreateWallet, handleStreamRequest } = require("./controller");
    server.put(`/stream/:domain/create-wallet/:userId`, handleCreateWallet);
    server.get(`/stream/:keySSI/*`, handleStreamRequest);
}

module.exports = Iframe;
