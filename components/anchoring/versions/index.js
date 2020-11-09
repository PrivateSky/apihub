function AnchorVersions(server) {
    const { URL_PREFIX } = require('./../constants.js');

    server.get(`${URL_PREFIX}/versions/:keyssi`, (request, response, next) => {
        const strategy = require("../utils").getAnchoringStrategy(request.params.keyssi);
        const flow = $$.flow.start(strategy.type);
        //const flow = $$.flow.start('ETH');
        flow.init(strategy,request.params.keyssi, request.body, server.rootFolder);
        flow.readVersions(request.params.keyssi,server, (err, fileHashes) => {
            if (err) {
                return response.send(404, 'Anchor not found');
            }

            response.setHeader('Content-Type', 'application/json');

            return response.send(200, fileHashes);
        });
    });
}

module.exports = AnchorVersions;
