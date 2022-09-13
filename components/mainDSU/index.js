function MainDSU(server) {
    const { init, handleDefaultMainDSURequest } = require("./controller");
    init(server);

    // for mobile app, when it includes the expanded DSU content instead of the actual DSU;
    // this will return a static DSU in order to set it as a main context
    server.use('/getSSIForMainDSU', handleDefaultMainDSURequest);
}

module.exports = MainDSU;
