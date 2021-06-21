const path = require("swarmutils").path;

const defaultConfig = {
    "storage": path.join(process.env.PSK_ROOT_INSTALATION_FOLDER, "tmp"),
    "externalStorage": "./external-volume",
    "sslFolder": path.join(process.env.PSK_ROOT_INSTALATION_FOLDER, "conf", "ssl"),
    "port": 8080,
    "host": "0.0.0.0",
    "zeromqForwardAddress": "tcp://127.0.0.1:5001",
    "preventRateLimit": false,
    // staticServer needs to load last
    "activeComponents": ["virtualMQ", "messaging", "notifications", "filesManager", "bricksLedger", "bricks", "anchoring", "bricksFabric", "dsu-wizard", "staticServer"],
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
            "function": "initWizard"
        },
        "bricks": {
            "module": "./components/bricks",           
        },
        "filesManager": {
            "module": "./components/fileManager"
        },
        "bricksFabric":{
          "module" : "./components/bricksFabric",
            "path": "./",         
        },
        "anchoring": {
            "module": "./components/anchoring",            
        },
        "staticServer": {
            "module": "./components/staticServer"
        },
        "bricksLedger": {
            "module": "./components/bricksLedger",
            "doAnchor" : "anchorCommand.js",
            "doEPIAnchor" : "EPIAnchorCommand.js"
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
    "enableRequestLogger": false,
    "enableJWTAuthorisation": false,
    "skipJWTAuthorisation": [
      "/leaflet-wallet",
      "/anchor",
      "/bricks",
      "/bricksFabric",
      "/bricksledger",  
      "/create-channel",
      "/forward-zeromq",
      "/send-message",
      "/receive-message",
      "/files",
      "/notifications",
      "/mq",
    ],
};

module.exports = Object.freeze(defaultConfig);