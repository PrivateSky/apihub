
const defaultConfig = {
    "storage":  require("swarmutils").path.join(process.env.PSK_ROOT_INSTALATION_FOLDER, "tmp"),
    "externalStorage": "./external-volume",
    "sslFolder":  require("swarmutils").path.join(process.env.PSK_ROOT_INSTALATION_FOLDER, "conf", "ssl"),
    "port": 8080,
    "host": "0.0.0.0",
    "zeromqForwardAddress": "tcp://127.0.0.1:5001",
    "preventRateLimit": false,
    // staticServer needs to load last
    "activeComponents": ["config", "mq", "enclave","secrets", "notifications", "filesManager", "bdns", "bricking", "anchoring", "bricksFabric", "contracts", "dsu-wizard", 'debugLogger', "mainDSU", "cloudWallet", "stream", "staticServer"],
    "componentsConfig": {
        "mq":{
            "module": "./components/mqHub",
            "function": "MQHub",
            "connectionTimeout": 10000
        },
        "enclave":{
            "module": "./components/enclave",
            "function": "LokiEnclaveFacade",
            "storageFolder": './external-volume/config/enclave',
            "dsuBootPath": "./psknode/bundles/nodeBoot.js"
        },
        "secrets":{
            "module": "./components/secrets"
        },
        "notifications": {
            "module": "./components/keySsiNotifications",
            "workingDirPath": "./external-volume/notifications"
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
        },
        "admin": {
            "module": "./components/admin",
            "function": "AdminComponentHandler",
            "storageFolder": './external-volume/config/admin'
        },
        "mainDSU": {
            "module": "./components/mainDSU"
        },
        "cloudWallet": {
            "module": "./components/cloudWallet",
            "dsuBootPath": "./psknode/bundles/nodeBoot.js"
        },
        "stream": {
            "module": "./components/stream"
        },
        "requestForwarder":{
            "module": "./components/requestForwarder"
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
        "/send-message",
        "/receive-message",
        "/files",
        "/notifications",
        "/mq",
        "/enclave",
        "/secrets",
        "/logs"
    ]
};

module.exports = Object.freeze(defaultConfig);
