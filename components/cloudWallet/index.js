function Iframe(server) {
    const { init, handleCloudWalletRequest } = require("./controller");
    init(server);

    server.use(`/cloud-wallet/:keySSI/*`, handleCloudWalletRequest);
    server.use(`/:walletName/loader/cloud-wallet/:keySSI/*`, handleCloudWalletRequest);

    // keep old URl style
    server.use(`/iframe/:keySSI/*`, handleCloudWalletRequest);
    server.use(`/:walletName/loader/iframe/:keySSI/*`, handleCloudWalletRequest);
}

module.exports = Iframe;
