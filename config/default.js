
const path =require('swarmutils').path;

const defaultConfig = {
    "storage": path.join(process.env.PSK_ROOT_INSTALATION_FOLDER, "tmp"),
    "sslFolder": path.join(process.env.PSK_ROOT_INSTALATION_FOLDER, "conf", "ssl"),
    "port": 8080,
    "host": "0.0.0.0",
    "zeromqForwardAddress": "tcp://127.0.0.1:5001",
    "preventRateLimit": false,
    // staticServer needs to load last
    "activeEndpoints": ["virtualMQ", "messaging", "notifications", "filesManager", "bricksLedger", "bricks", "anchoring", "dossier-wizard", "staticServer"],
    "endpointsConfig": {
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
        "dossier-wizard": {
            "module": "dossier-wizard"
        },
        "bricks": {
            "module": "./components/bricks"
        },
        "filesManager": {
            "module": "./components/fileManager"
        },
        "anchoring": {
            "module": "./components/anchoring"
        },
        "staticServer": {
            "module": "./components/staticServer"
        },
        "bricksLedger": {
            "module": "./components/bricksLedger",
            "brickFabric": {
                "url": "http://localhost:8080/bricks",
                "size": 2
            },
            "commands": {
                "addAnchor": {
                    "url": "http://localhost:8080/test",
                },
                // "testurl2": {
                //     "url": "httpa://localhost:8080/test",
                // },
                // "testmethod": {
                //     "module": "./commands.mock2.js",
                //     "function": "commandsMock2"
                // },
            }
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
    }
};

module.exports = Object.freeze(defaultConfig);