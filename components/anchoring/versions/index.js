function AnchorVersions(server) {
    const { URL_PREFIX } = require('./../constants');
    
    server.get(`${URL_PREFIX}/versions/:keyssi`, (request, response, next) => {
        $$.flow.start('AnchorsManager').readVersions(request.params.keyssi, (err, fileHashes) => {
            if (err) {
                return response.send(404, 'Anchor not found');
            }

            response.setHeader('Content-Type', 'application/json');

            return response.send(200, fileHashes);
        });
    });
}

module.exports = AnchorVersions;
