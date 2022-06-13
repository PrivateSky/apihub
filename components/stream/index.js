function Iframe(server) {
    const { handleStreamRequest } = require("./controller");
    server.use(`/stream/:keySSI/*`, handleStreamRequest);
}

module.exports = Iframe;
