function Iframe(server) {
    const { init, handleIframeRequest } = require("./controller");
    init(server);

    server.use(`/iframe/:keySSI/*`, handleIframeRequest);
    server.use(`/:walletName/loader/iframe/:keySSI/*`, handleIframeRequest);
}

module.exports = Iframe;
