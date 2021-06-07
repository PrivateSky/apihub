function requestFSBrickStorageMiddleware(request, response, next) {
    const { domain } = request.params;

    const domainConfig = require("./utils").getBricksDomainConfig(domain);
    if (!domainConfig) {
        const message = `[Bricking] Domain '${domain}' not found`;
        console.error(message);
        return response.send(404, message);
    }

    request.fsBrickStorage = require("bricksledger").createFSBrickStorage(domain, {
        server: { path: request.server.rootFolder },
        domain: domainConfig
    });

    next();
}

module.exports = {
    requestFSBrickStorageMiddleware
}