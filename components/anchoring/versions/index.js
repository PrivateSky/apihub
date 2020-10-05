function AnchorVersions(server) {
    const { URL_PREFIX } = require('./../constants.js');

    server.get(`${URL_PREFIX}/versions/:keyssi`, (request, response, next) => {
        const strategy = require("../utils").getAnchoringStrategy(request.params.keyssi);
        $$.flow.start(strategy.name).init(strategy.option.path);
        $$.flow.start(strategy.name).readVersions(request.params.keyssi, (err, fileHashes) => {
            if (err) {
                return response.send(404, 'Anchor not found');
            }

            response.setHeader('Content-Type', 'application/json');

            return response.send(200, fileHashes);
        });
    });
}

module.exports = AnchorVersions;
