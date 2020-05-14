function ServerConfig(conf) {
    const path = require("path");
    const defaultConf = {
        storage: path.join(path.resolve("." + __dirname + "/../.."), "tmp"),
        "port": 8080,
        "zeromqForwardAddress": "tcp://127.0.0.1:5001",
        "preventRateLimit": false,
        "endpoints": ["virtualMQ", "filesManager", "edfs", "dossier-wizard"],
        "endpointsConfig": {
            "virtualMQ": {
                "path": "./modules/psk-webserver/ChannelsManager.js",
                "channelsFolderName": "channels",
                "maxSize": 100,
                "tokenSize": 48,
                "tokenHeaderName": "x-tokenHeader",
                "signatureHeaderName": "x-signature",
                "enableSignatureCheck": true
            },
            "dossier-wizard": {
                "path": "dossier-wizard"
            },
            "edfs": {
                "path": "edfs-middleware"
            },
            "filesManager": {
                "path": "./modules/psk-webserver/FilesManager.js"
            }
        }
    };

    function createConfig(config, defaultConfig) {
        if (typeof config === "undefined") {
            return defaultConfig;
        }

        //ensure that the config object will contain all the necessary keys for server configuration
        for (let mandatoryKey in defaultConfig) {
            if (typeof config[mandatoryKey] === "undefined") {
                config[mandatoryKey] = defaultConfig[mandatoryKey];
            }
        }
        return __createConfigRecursively(conf, defaultConf);

        function __createConfigRecursively(config, defaultConfig) {
            for (let prop in defaultConfig) {
                if (typeof config[prop] === "object" && !Array.isArray(config[prop])) {
                    __createConfigRecursively(config[prop], defaultConfig[prop]);
                } else {
                    if (typeof config[prop] === "undefined") {
                        //only non-object values and arrays in defaultConfig are copied in config
                        if (typeof defaultConfig[prop] !== "object" || Array.isArray(defaultConfig[prop])) {
                            config[prop] = defaultConfig[prop];
                        }
                    }
                }
            }
            return config;
        }
    }

    conf = createConfig(conf, defaultConf);
    return conf;
}

module.exports = ServerConfig;