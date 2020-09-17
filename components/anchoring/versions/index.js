const config = require('../../config');
const pskCrypto = require('../../../pskcrypto');

function AnchorVersions(server) {
    const { URL_PREFIX } = require('./../constants');

    server.get(`${URL_PREFIX}/versions/:keyssi`, (request, response, next) => {
        const keyIdentifier = pskCrypto.pskBase58Decode(request.params.keyssi).toString();
        const domain = keyIdentifier.split(':')[2];
        let stategy = config.getConfig('endpointsConfig', 'anchoring', 'domainStrategies', domain);

        if (!stategy) {
            stategy = config.getConfig('endpointsConfig', 'anchoring', 'domainStrategies', 'default');
        }

        $$.flow.start(stategy.name).init(stategy.option.path);
        $$.flow.start(stategy.name).readVersions(request.params.keyssi, (err, fileHashes) => {
            if (err) {
                return response.send(404, 'Anchor not found');
            }

            response.setHeader('Content-Type', 'application/json');

            return response.send(200, fileHashes);
        });
    });
}

module.exports = AnchorVersions;
