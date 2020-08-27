const path = require('swarmutils').path;
const defaultConfig = require('./default');

let serverConfig;

function getConfig(...keys) {
    if (!serverConfig) {
        const serverJson = typeof serverConf === "undefined" ? require(path.join(process.env.PSK_CONFIG_LOCATION, 'server.json')) : '';

        serverConfig = new ServerConfig(serverJson);
    }

    if (!Array.isArray(keys) || !keys) {
        return serverConfig;
    }

    return getSource(keys, serverConfig);
}

function ServerConfig(conf) {
    function createConfig(config) {
        if (typeof config === "undefined") {
            return defaultConfig;
        }

        //ensure that the config object will contain all the necessary keys for server configuration
        for (let mandatoryKey in defaultConfig) {
            if (typeof config[mandatoryKey] === "undefined") {
                config[mandatoryKey] = defaultConfig[mandatoryKey];
            }
        }

        return __createConfigRecursively(conf);

        function __createConfigRecursively(config) {
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

    conf = createConfig(conf);
    conf.defaultEndpoints = defaultConfig.activeEndpoints;

    return conf;
}

function getSource(arrayKeys, source) {
    if (!arrayKeys.length || source === undefined) {
        return source;
    }

    return getSource(arrayKeys, source[arrayKeys.shift()]);
}

module.exports = { getConfig }
