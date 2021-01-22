function AnchorVersions(server) {

    server.get(`/anchor/:domain/versions/:keyssi`, (request, response, next) => {

        // get the domain configuration based on the domain extracted from anchorId.
        const receivedDomain = require('../utils').getDomainFromKeySSI(request.params.keyssi);
        const domainConfig = require("../utils").getAnchoringDomainConfig(receivedDomain);
        if (!domainConfig)
        {
            console.log('Anchoring Domain not found : ', receivedDomain);
            return response.send(500);
        }
        const flow = $$.flow.start(domainConfig.type);
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
