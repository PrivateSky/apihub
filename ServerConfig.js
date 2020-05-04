function ServerConfig(conf) {
    const path = require("path");
    const defaultConf = {
        storage: path.join(path.resolve("." + __dirname + "/../.."), "tmp"),
        "port": 8080,
        "zeromqForwardAddress": "tcp://127.0.0.1:5001",
        "endpoints": {
            "virtualMQ": {
                "channelsFolderName": "channels",
                "maxSize": 100,
                "tokenSize": 48,
                "tokenHeaderName": "x-tokenHeader",
                "signatureHeaderName": "x-signature",
                "enableSignatureCheck": true
            },
            "staticServer": true,
            "edfs": true,
            "filesManager": true,
            "dossierWizard": true

        }
    };
    conf = conf || defaultConf;

    this.getStorage = () => {
        if (typeof conf.storage === "undefined") {
            return defaultConf.storage;
        }

        return conf.storage;
    };

    this.getPort = () => {
        if (typeof conf.port === "undefined") {
            return defaultConf.port;
        }

        return conf.port;
    };

    this.getZeromqForwardAddress = () => {
        if (typeof conf.zeromqForwardAddress === "undefined")  {
            return defaultConf.zeromqForwardAddress;
        }

        return conf.zeromqForwardAddress;
    };

    this.getChannelsFolderName = () => {
        if (typeof conf.endpoints === "undefined" || typeof conf.endpoints.virtualMQ ==="undefined" || typeof conf.endpoints.virtualMQ.channelsFolderName === "undefined") {
            return defaultConf.endpoints.virtualMQ.channelsFolderName;
        }

        return conf.endpoints.virtualMQ.channelsFolderName;
    };

    this.getTokenSize = () => {
        if (typeof conf.endpoints === "undefined" || typeof conf.endpoints.virtualMQ ==="undefined" || typeof conf.endpoints.virtualMQ.tokenSize === "undefined") {
            return defaultConf.endpoints.virtualMQ.tokenSize;
        }

        return conf.endpoints.virtualMQ.tokenSize;
    };

    this.getTokenHeaderName = () => {
        if (typeof conf.endpoints === "undefined" || typeof conf.endpoints.virtualMQ ==="undefined" || typeof conf.endpoints.virtualMQ.tokenHeaderName === "undefined") {
            return defaultConf.endpoints.virtualMQ.tokenHeaderName;
        }

        return conf.endpoints.virtualMQ.tokenHeaderName;
    };

    this.getSignatureHeaderName = () => {
        if (typeof conf.endpoints === "undefined" || typeof conf.endpoints.virtualMQ ==="undefined" || typeof conf.endpoints.virtualMQ.signatureHeaderName === "undefined") {
            return defaultConf.endpoints.virtualMQ.signatureHeaderName;
        }

        return conf.endpoints.virtualMQ.signatureHeaderName;
    };

    this.signatureCheckIsEnabled = () => {
        if (typeof conf.endpoints === "undefined" || typeof conf.endpoints.virtualMQ ==="undefined" || typeof conf.endpoints.virtualMQ.enableSignatureCheck === "undefined") {
            return defaultConf.endpoints.virtualMQ.enableSignatureCheck;
        }

        return conf.endpoints.virtualMQ.enableSignatureCheck;
    };

    this.getMaxQueueSize = () => {
        if (typeof conf.endpoints === "undefined" || typeof conf.endpoints.virtualMQ ==="undefined" || typeof conf.endpoints.virtualMQ.maxSize === "undefined") {
            return defaultConf.endpoints.virtualMQ.maxSize;
        }

        return conf.endpoints.virtualMQ.maxSize;
    };

    this.getEnabledMiddlewareList = () => {
        if (typeof conf.endpoints === "undefined") {
            return Object.keys(defaultConf.endpoints);
        }

        return Object.keys(conf.endpoints);
    };
}

module.exports = ServerConfig;