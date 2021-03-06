const path = require("swarmutils").path;

const defaultConfig = {
    "storage": path.join(process.env.PSK_ROOT_INSTALATION_FOLDER, "tmp"),
    "sslFolder": path.join(process.env.PSK_ROOT_INSTALATION_FOLDER, "conf", "ssl"),
    "port": 8080,
    "host": "0.0.0.0",
    "zeromqForwardAddress": "tcp://127.0.0.1:5001",
    "preventRateLimit": false,
    // staticServer needs to load last
    "activeEndpoints": ["virtualMQ", "messaging", "notifications", "filesManager", "bricksLedger", "bricks", "anchoring", "bricksFabric", "dsu-wizard", "staticServer"],
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
        "dsu-wizard": {
            "module": "dsu-wizard",
            "function": "initWizard"
        },
        "bricks": {
            "module": "./components/bricks",
            "domains" : {
                "default" : {
                    "path" :"/internal-volume/domains/default/brick-storage" },
                "predefined" : {
                    "path" :"/internal-volume/domains/predefined/brick-storage" },
                "vault" : {
                    "path" :"/internal-volume/domains/vault/brick-storage"
                },
                "EPI" : {
                    "path" :"/external-volume/domains/epi/brick-storage"
                }
            }
        },
        "filesManager": {
            "module": "./components/fileManager"
        },
        "bricksFabric":{
          "module" : "./components/bricksFabric",
            "path": "./",
          "domainStrategies" : {
              "default" : {
                  "name": "BrickStorage",
                  "option" : {
                      "timeout" : 15000,
                     "transactionsPerBlock" : 5
                  }
              }
          }
        },
        "anchoring": {
            "module": "./components/anchoring",
            "domainStrategies": {
                "default": {
                    "type": "FS",
                    "option": {
                        "path": "/internal-volume/domains/default/anchors",
                        "enableBricksLedger" : false
                    },
                    "commands" : {
                        "addAnchor": "anchor"
                       }

                },
                "predefined": {
                    "type": "FS",
                    "option": {
                        "path": "/internal-volume/domains/predefined/anchors"
                    }
                },
                "vault":{
                    "type": "FS",
                    "option": {
                        "path": "/internal-volume/domains/vault/anchors"
                    }
                },
                "ETH": {
                    "type" : "ETH",
                    "option" : {
                        "endpoint" : "http://localhost:3000", // endpoint to the APIAdapter which will make the requests to the blockchain network
                    } // operation will be done directly into the Ethereum API -> jsonrpc-> network
                }
            }
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
    "enableAuthorisation": false,
    "skipAuthorisation": [
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