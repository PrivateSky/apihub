const { ALIAS_SYNC_ERR_CODE } = require("../utils");

function getHandlerForAnchorCreateOrAppend(response) {
    return (err, _) => {
        if (err) {
            
            const errorMessage = typeof err === "string" ? err : err.message;
            if (err.code === "EACCES") {
                return response.send(409, errorMessage);
            } else if (err.code === ALIAS_SYNC_ERR_CODE) {
                // see: https://tools.ietf.org/html/rfc6585#section-3
                return response.send(428, errorMessage);
            } else if (err.code === 403) {
                return response.send(403, errorMessage);
            }

            return response.send(500, errorMessage);
        }

        response.send(201);
    };
}

function createAnchor(request, response) {
    request.strategy.createAnchor(getHandlerForAnchorCreateOrAppend(response));
}

function appendToAnchor(request, response) {
    request.strategy.appendToAnchor(getHandlerForAnchorCreateOrAppend(response));
}

function getAllVersions(request, response) {
    request.strategy.getAllVersions((err, fileHashes) => {
        if (err) {
            return response.send(404, "Anchor not found");
        }

        response.setHeader("Content-Type", "application/json");

        return response.send(200, fileHashes);
    });
}

module.exports = {
    createAnchor,
    appendToAnchor,
    getAllVersions
};
