const { ALIAS_SYNC_ERR_CODE } = require('./strategies/File');

function addAnchor(request, response, next) {
    const strategy = require("./utils").getAnchoringStrategy(request.params.keyssi);
    $$.flow.start(strategy.name).init(strategy.option.path);

    $$.flow.start(strategy.name).addAlias(request.params.keyssi, request, (err, result) => {
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
