function ServerConfig(conf) {
    const path = require("path");
    const defaultConf = {
        storage: path.join(path.resolve("." + __dirname + "/../.."), "tmp"),
        "port": 8080,
        "zeromqForwardAddress": "tcp://127.0.0.1:5001",
        "endpoints":["virtualMQ", "edfs", "filesManager", "dossierWizard"],
        "endpointsConfig": {
            "virtualMQ": {
                "channelsFolderName": "channels",
                "maxSize": 100,
                "tokenSize": 48,
                "tokenHeaderName": "x-tokenHeader",
                "signatureHeaderName": "x-signature",
                "enableSignatureCheck": true
            }
        }
    };
    conf = conf || {};
    conf = Object.assign(defaultConf, conf);
    return conf;
}

module.exports = ServerConfig;