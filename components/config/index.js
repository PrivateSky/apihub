const config = require("../../config");

function Config(server) {
    const { requestBodyJSONMiddleware, responseModifierMiddleware } = require("../../utils/middlewares");

    function getDomainConfig(request, response) {
        const { domain } = request.params;
        const domainConfig = config.getDomainConfig(domain);

        if (!domainConfig) {
            return response.send(404, "Domain not found");
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
        config.updateDomainConfig(domain, domainConfig, (error) => {
            if (error) {
                return response.send(500, error);
            }
            response.send(200);
        });
    }

    server.use(`/config/:domain/*`, responseModifierMiddleware);

    server.get(`/config/:domain`, getDomainConfig);

    server.put(`/config/:domain`, requestBodyJSONMiddleware);
    server.put(`/config/:domain`, validateDomainConfigInput);
    server.put(`/config/:domain`, updateDomainConfig);
}

module.exports = Config;
