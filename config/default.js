
const defaultConfig = {
    "storage":  require("swarmutils").path.join(process.env.PSK_ROOT_INSTALATION_FOLDER, "tmp"),
    "externalStorage": "./external-volume",
    "sslFolder":  require("swarmutils").path.join(process.env.PSK_ROOT_INSTALATION_FOLDER, "conf", "ssl"),
    "port": 8080,
    "host": "0.0.0.0",
    "zeromqForwardAddress": "tcp://127.0.0.1:5001",
    "preventRateLimit": false,
    // staticServer needs to load last
    "activeComponents": ["config", "virtualMQ", "messaging", "notifications", "filesManager", "bdns", "bricking", "anchoring", "bricksFabric", "contracts", "dsu-wizard", 'debugLogger', "staticServer"],
    "componentsConfig": {
        "messaging": {
            "module": "./components/mqManager",
            "workingDirPath": "./messaging",
            "storageDirPath": "./messaging/storage"
        },
        "notifications": {
            "module": "./components/keySsiNotifications",
            "workingDirPath": "./notifications"
        },
        "virtualMQ": {
            "module": "./components/channelManager",
            "channelsFolderName": "channels",
            "maxSize": 100,
            "tokenSize": 48,
            "tokenHeaderName": "x-tokenHeader",
            "signatureHeaderName": "x-signature",
            "enableSignatureCheck": true
        },
        "dsu-wizard": {
            "module": "dsu-wizard",
            "function": "initWizard",
            "storage": "./external-volume/dsu-wizard/transactions",
            "workers": 5,
            "bundle": "./../privatesky/psknode/bundles/openDSU.js"
        },
        "bdns": {
            "module": "./components/bdns",
        },
        "bricking": {
            "module": "./components/bricking",
        },
        "filesManager": {
            "module": "./components/fileManager"
        },
        "bricksFabric": {
            "module": "./components/bricksFabric",
            "path": "./",
            "bricksFabricStrategy": "BrickStorage",
            "bricksFabricStrategyOption": {
                "timeout": 15000,
                "transactionsPerBlock": 5
            }
        },
        "anchoring": {
            "module": "./components/anchoring",
            "anchoringStrategy": "FS"
        },
        "debugLogger": {
            "module": './components/debugLogger',
            "workingDirPath": './external-volume/debug-logger',
            "storageDirPath": './external-volume/debug-logger/storage',
        },
        "staticServer": {
            "module": "./components/staticServer"
        },
        "contracts": {
            "module": "./components/contracts",
            "domainsPath": "/external-volume/domains"
        }
    },
    "tokenBucket": {
        "cost": {
            "low": 10,
            "medium": 100,
            "high": 500
        },
        "error": {
            "limitExceeded": "error_limit_exceeded",
            "badArgument": "error_bad_argument"
        },
        "startTokens": 6000,
        "tokenValuePerTime": 10,
        "unitOfTime": 100
    },
    "enableInstallationDetails": true,
    "enableRequestLogger": true,
    "enableJWTAuthorisation": false,
    "enableLocalhostAuthorization": false,
    "skipJWTAuthorisation": [
        "/leaflet-wallet",
        "/config",
        "/anchor",
        "/bricking",
        "/bricksFabric",
        "/create-channel",
        "/forward-zeromq",
        "/send-message",
        "/receive-message",
        "/files",
        "/notifications",
        "/mq",
        "/logs"
    ],
    "iframeHandlerDsuBootPath": "./psknode/bundles/nodeBoot.js"
};

module.exports = Object.freeze(defaultConfig);
