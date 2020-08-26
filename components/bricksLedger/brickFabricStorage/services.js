
const { makeRequest } = require('../../../utils').requests;
const serverConfigUtils = require('../../../utils').serverConfig;

const brickURL = serverConfigUtils.getConfig('endpointsConfig', 'bricksLedger', 'brickFabric', 'url');
const fabricSize = serverConfigUtils.getConfig('endpointsConfig', 'bricksLedger', 'brickFabric', 'size');

const fs = require('fs');
const fileName = './bfs.json';
const pskCrypto = require('../../../../pskcrypto');

async function brickFabricStorageService(commandType, comamndBody, commandResponse) {
    const tempBrick = {
        previousBrick: { brickHash: '', password: '' },
        commands: []
    };

    if (!fs.existsSync(fileName)) {
        const mockGenesisBrick = {
            genesis: true,
            id: $$.uidGenerator.safe_uuid()
        };

        tempBrick.previousBrick.brickHash = await addBrick(mockGenesisBrick);
    } else {
        const { previousBrick, commands } = await readFromFile();

        tempBrick.previousBrick = previousBrick;
        tempBrick.commands = commands;

        if (tempBrick.commands.length === fabricSize) {
            tempBrick.previousBrick.brickHash.password = pskCrypto.randomBytes();
            const encryptedBrick = pskCrypto.privateEncrypt(tempBrick.previousBrick.brickHash.password, brickData);

            tempBrick.previousBrick.brickHash = await addBrick(encryptedBrick);
            tempBrick.commands = [];
        }
    }

    tempBrick.commands.push({ commandType, comamndBody, commandResponse });

    await writeToFile(tempBrick).catch((err) => {
        throw err;
    });

    return;
}

function writeToFile(data) {
    return new Promise((resolve, reject) => {
        fs.writeFile(fileName, JSON.stringify(data), (err) => {
            if (err) {
                return reject(err);
            }

            resolve();
        });
    })
}

function readFromFile() {
    return new Promise((resolve, reject) => {
        fs.readFile(fileName, (err, data) => {
            if (err) {
                return reject(err);
            }

            resolve(JSON.parse(data));
        });
    })
}

async function addBrick(brickData) {
    const { body: brickHash } = await makeRequest(brickURL, 'POST', encrypted).catch((err) => {
        throw err;
    });
    
    return brickHash;
}

module.exports.brickFabricStorageService = brickFabricStorageService;
