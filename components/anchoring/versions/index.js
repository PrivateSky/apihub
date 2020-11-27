function AnchorVersions(server) {

    server.get(`/anchor/:domain/versions/:keyssi`, (request, response, next) => {
        const domainConfig = require("../utils").getAnchoringDomainConfig(request.params.keyssi);
        const flow = $$.flow.start(domainConfig.type);
        //const flow = $$.flow.start('ETH');
        flow.init(domainConfig,request.params.keyssi, request.body, server.rootFolder);
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
