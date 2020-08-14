
const path = require("path");

const defaultConfig = {
    "storage": path.join(process.env.PSK_ROOT_INSTALATION_FOLDER, "tmp"),
    "sslFolder": path.join(process.env.PSK_ROOT_INSTALATION_FOLDER, "conf", "ssl"),
    "port": 8080,
    "host": "0.0.0.0",
    "zeromqForwardAddress": "tcp://127.0.0.1:5001",
    "preventRateLimit": false,
    // staticServer needs to load last
    "activeEndpoints": ["virtualMQ", "messaging", "notifications", "filesManager", "worldStateManagerStrategy", "brickFabricStorage", "mock", "anchoring", "edfs", "dossier-wizard", "staticServer"],
    "endpointsConfig": {
        "messaging": {
            "module": "./libs/MQManager.js",
            "workingDirPath": "./messaging",
            "storageDirPath": "./messaging/storage"
        },
        "notifications": {
            "module": "./libs/KeySSINotificationsManager.js",
            "workingDirPath": "./notifications"
        },
        "virtualMQ": {
            "module": "./ChannelsManager.js",
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
        "edfs": {
            "module": "edfs-middleware",
            "function": "BrickStorageMiddleware"
        },
        "filesManager": {
            "module": "./FilesManager.js"
        },
        "anchoring": {
            "module": "edfs-middleware",
            "function": "AnchoringMiddleware"
        },
        "staticServer": {
            "module": "./StaticServer.js"
        },
        "worldStateManagerStrategy": {
            "module": "./WorldStateManagerStrategy.js",
            "brickFabric": {
                "url": "http://localhost:8080/bricks",
                "size": 2
            },
            "commands": {
                "testurl": {
                    "url": "http://localhost:8080/test",
                },
                "testurl2": {
                    "url": "httpa://localhost:8080/test",
                },
                "testmethod": {
                    "module": "./commands.mock2.js",
                    "function": "commandsMock2"
                },
                "testmethod2": {
                    "module": "./commands.mock3.js",
                    "function": "commandsMock2"
                }
            }
        }
    }
};

module.exports = Object.freeze(defaultConfig);