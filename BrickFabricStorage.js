const fs = require('fs');
const fileName = './bfs.json';
const { makeRequest } = require('./utils').requests;
const serverConfigUtils = require('./utils').serverConfig;
const brickURL = serverConfigUtils.getConfig('endpointsConfig', 'worldStateManagerStrategy', 'brickFabric', 'url');
const fabricSize = serverConfigUtils.getConfig('endpointsConfig', 'worldStateManagerStrategy', 'brickFabric', 'size');

async function BrickFabricStorage(commandType, comamndBody, callback) {
    const tempBrick = {
        previousBrick: '',
        commands: []
    };

    if (!fs.existsSync(fileName)) {
        const mockGenesisBrick = {
            genesis: true,
            id: $$.uidGenerator.safe_uuid()
        };

        tempBrick.previousBrick = await addBrick(mockGenesisBrick);
    } else {
        const { previousBrick, commands } = await readFromFile();

        tempBrick.previousBrick = previousBrick;
        tempBrick.commands = commands;

        if (tempBrick.commands.length === fabricSize) {
            tempBrick.previousBrick = await addBrick(tempBrick)
            tempBrick.commands = [];
        }
    }

    tempBrick.commands.push({ commandType, comamndBody });

    await writeToFile(tempBrick).catch((err) => {
        throw err;
    });

    callback();
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
    const { body: brickHash } = await makeRequest(brickURL, 'POST', brickData).catch((err) => {
        throw err;
    });

    return brickHash;
}

module.exports = BrickFabricStorage;
