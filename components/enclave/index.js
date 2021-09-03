const config = require("../../config");
function DefaultEnclave(server) {
    const { headersMiddleware, responseModifierMiddleware, requestBodyJSONMiddleware } = require('../../utils/middlewares');
    const domains = [];
    const path = require("path");
    const fs = require("fs");
    const storageFolder = path.join(server.rootFolder, "enclave");
    try {
        fs.mkdirSync(storageFolder, {recursive: true})
    }catch (e) {
        console.log(`Failed to create folder ${storageFolder}`, e);
    }

    function requestServerMiddleware(request, response, next) {
        request.server = server;
        next();
    }

    function runEnclaveCommand(request, response) {
        const domainName = request.params.domain;
        if (domains.indexOf(domainName) === -1) {
            console.log(`Caught an request to the enclave for domain ${domainName}. Looks like the domain doesn't have enclave component enabled.`);
            response.statusCode = 405;
            response.end();
            return;
        }

        response.setHeader("Content-Type", "application/json");

        const CommandFactory = require("./commands/CommandsFactory")
        request.body.params.storageFolder = storageFolder;
        const command = CommandFactory.createCommand(request.body.commandName, request.body.params);
        command.execute((err, data)=>{
            if (err) {
                console.log(err);
                return response.send(500, `Failed to execute command ${request.body.commandName}`);
            }

            return response.send(200, data);
        })
    }

    function getConfiguredDomains() {
        let confDomains = typeof config.getConfiguredDomains !== "undefined" ? config.getConfiguredDomains() : ["default"];

        for (let i = 0; i < confDomains.length; i++) {
            let domain = confDomains[i];
            let domainConfig = config.getDomainConfig(domain);

            if (domainConfig && domainConfig.enable && domainConfig.enable.indexOf("enclave") !== -1) {
                console.log(`Successfully register enclave endpoints for domain < ${domain} >.`);
                domains.push(domain);
            }
        }
    }

    getConfiguredDomains();
    server.use(`/runEnclaveCommand/:domain/*`, headersMiddleware);
    server.use(`/runEnclaveCommand/:domain/*`, responseModifierMiddleware);
    server.use(`/runEnclaveCommand/:domain/*`, requestBodyJSONMiddleware);
    server.use(`/runEnclaveCommand/:domain/*`, requestServerMiddleware);
    server.put("/runEnclaveCommand/:domain/:enclaveDID", runEnclaveCommand);
}

module.exports = {
    DefaultEnclave
};
