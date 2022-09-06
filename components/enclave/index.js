const {resolve} = require("path");
const config = require("../../config");

function DefaultEnclave(server) {
    const {
        headersMiddleware,
        responseModifierMiddleware,
        requestBodyJSONMiddleware,
        bodyReaderMiddleware
    } = require('../../utils/middlewares');
    const domains = [];
    const path = require("path");
    const fs = require("fs");
    const openDSU = require("opendsu");
    const w3cDID = openDSU.loadAPI("w3cdid");
    const crypto = openDSU.loadAPI("crypto");

    const storageFolder = path.join(server.rootFolder, "external-volume", "enclave");

    try {
        fs.mkdirSync(storageFolder, {recursive: true})
    } catch (e) {
        console.log(`Failed to create folder ${storageFolder}`, e);
    }

    w3cDID.createIdentity("key", undefined, process.env.REMOTE_ENCLAVE_SECRET, (err, didDocument) => {
        didDocument.readMessage((err, res) => {
            console.log("Error", err);
            console.log("Res", res);
        });
    });


    function requestServerMiddleware(request, response, next) {
        request.server = server;
        next();
    }

    function domainIsConfigured(request, response) {
        const domainName = request.params.domain;
        if (domains.indexOf(domainName) === -1) {
            console.log(`Caught an request to the enclave for domain ${domainName}. Looks like the domain doesn't have enclave component enabled.`);
            response.statusCode = 405;
            response.end();
            return false;
        }
        return true;
    }

    function runEnclaveEncryptedCommand(request, response) {
        if (!domainIsConfigured(request, response)) {
            return;
        }

        const enclaveDID = request.params.enclaveDID;

        w3cDID.resolveDID(enclaveDID, (err, didDocument) => {
            if (err) {
                response.statusCode = 500;
                response.end();
                return;
            }

            didDocument.getPublicKey("raw", (err, publicKey) => {
                if (err) {
                    response.statusCode = 500;
                    response.end();
                    return;
                }

                const encryptionKey = crypto.deriveEncryptionKey(publicKey);
                let decryptedCommand;
                try {
                    decryptedCommand = crypto.decrypt(request.body, encryptionKey);
                    decryptedCommand = JSON.parse(decryptedCommand.toString());
                } catch (e) {
                    response.statusCode = 500;
                    response.end();
                    return;
                }

                request.body = decryptedCommand;
                runEnclaveCommand(request, response);
            })
        })
    }

    function runEnclaveCommand(request, response) {
        if (!domainIsConfigured(request, response)) {
            return;
        }
        response.setHeader("Content-Type", "application/json");

        request.body.params.push(path.join(storageFolder, crypto.encodeBase58(Buffer.from(request.params.enclaveDID))));
        const command = require("./commands").createCommand(request.body.commandName, ...request.body.params);
        command.execute((err, data) => {
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

    server.use(`/runEnclaveEncryptedCommand/:domain/*`, headersMiddleware);
    server.use(`/runEnclaveEncryptedCommand/:domain/*`, responseModifierMiddleware);
    server.use(`/runEnclaveEncryptedCommand/:domain/*`, bodyReaderMiddleware);
    server.use(`/runEnclaveEncryptedCommand/:domain/*`, requestServerMiddleware);
    server.put("/runEnclaveEncryptedCommand/:domain/:enclaveDID", runEnclaveEncryptedCommand);
}

module.exports = {
    DefaultEnclave
};
