async function BrickFabricStorage(commandType, comamndBody, callback) {
    const fs = require('fs');
    const { getRequest, makeRequest } = require('./utils').requests;
    const serverConfigUtils = require('./utils').serverConfig;

    const brickURL = serverConfigUtils.getConfig('endpointsConfig', 'worldStateManagerStrategy', 'brickStorage');

    if (!fs.existsSync('./bfs.json')) {
        commandResponse = await makeRequest(brickURL, 'POST', { genesis: true }).catch(err => console.log(err));
        console.log(commandResponse)
    }

    // const response = await getRequest(brickURL);
    callback();
}

module.exports = BrickFabricStorage;
