
function addAnchor(request, response, next) {
    $$.flow.start("AnchorsManager").addAlias(request.params.fileId, request.params.lastHash, request, (err, result) => {
        if (err) {
            if (err.code === 'EACCES') {
                return response.send(409, null, next);
            }

            if (err.code === AnchorsManager.ALIAS_SYNC_ERR_CODE) {
                // see: https://tools.ietf.org/html/rfc6585#section-3
                return response.send(428, null, next);
            }

            return response.send(500, null, next);
        }

        response.send(201, null, next);
    });
}

module.exports = { addAnchor };
