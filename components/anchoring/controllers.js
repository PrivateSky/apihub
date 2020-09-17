const config = require('../../config');
const pskCrypto = require('../../../pskcrypto');

const { ALIAS_SYNC_ERR_CODE } = require('./strategies/File');

function addAnchor(request, response, next) {
    const keyIdentifier = pskCrypto.pskBase58Decode(request.params.keyssi).toString();
    const domain = keyIdentifier.split(':')[2];
    let stategy = config.getConfig('endpointsConfig', 'anchoring', 'domainStrategies', domain);

    if (!stategy) {
        stategy = config.getConfig('endpointsConfig', 'anchoring', 'domainStrategies', 'default');
    }

    $$.flow.start(stategy.name).init(stategy.option.path);

    $$.flow.start(stategy.name).addAlias(request.params.keyssi, request, (err, result) => {
        if (err) {
            if (err.code === 'EACCES') {
                return response.send(409);
            }

            if (err.code === ALIAS_SYNC_ERR_CODE) {
                // see: https://tools.ietf.org/html/rfc6585#section-3
                return response.send(428);
            }

            return response.send(500);
        }

        response.send(201);
    });
}

module.exports = { addAnchor };
