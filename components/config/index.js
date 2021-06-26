const config = require("../../config");

function Config(server) {
    const { requestBodyJSONMiddleware, responseModifierMiddleware } = require("../../utils/middlewares");

    function getDomainConfig(request, response) {
        const { domain } = request.params;
        let domainConfig;
        try {
            domainConfig = config.getDomainConfig(domain);
        } catch (e) {
            console.error(e);
            return response.send(500, "Unable to fetch domain configuration");
        }
        response.send(200, domainConfig);
    }

    function validateDomainConfigInput(request, response, next) {
        if (!request.body || typeof request.body !== "object") {
            return response(400, "Invalid domain config specified");
        }
        next();
    }

    function updateDomainConfig(request, response) {
        const { domain } = request.params;
        const domainConfig = request.body;
        try {
            config.updateDomainConfig(domain, domainConfig, (error) => {
                if (error) {
                    return response.send(500, error);
                }
                response.send(200);
            });
        } catch (e) {
            console.error(e);
            response.send(500, "Unable to update domain configuration");
        }
    }

    server.use(`/config/:domain/*`, responseModifierMiddleware);

    server.get(`/config/:domain`, getDomainConfig);

    server.put(`/config/:domain`, requestBodyJSONMiddleware);
    server.put(`/config/:domain`, validateDomainConfigInput);
    server.put(`/config/:domain`, updateDomainConfig);
}

module.exports = Config;
