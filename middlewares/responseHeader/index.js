function ResponseHeaders(server) {
    const logger = $$.getLogger("ResponseHeaders", "apihub/responseHeaders");

    logger.info(`Registering Response Headers middleware`);

    const config = require("../../config");
    const responseHeaders = config.getConfig("responseHeaders");

    server.use(function (req, res, next) {
        if (!responseHeaders) {
            return next();
        }
        for (let header in responseHeaders) {
            res.setHeader(header, responseHeaders[header]);
        }

        next();
    });
}

module.exports = ResponseHeaders;
