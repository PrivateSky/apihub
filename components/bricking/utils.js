function convertReadableStreamToBuffer(readStream, callback) {
    let buffers = [];

    readStream.on('data', (chunk) => buffers.push(chunk));

    readStream.on('error', (error) => callback(error));

    readStream.on('end', () => callback(undefined, $$.Buffer.concat(buffers)));
}

function getBricksDomainConfig(domain) {
    const config = require("../../config");
    return config.getDomainConfig(domain, ['bricking'], ['endpointsConfig', 'bricking', 'domains']);
}

module.exports = {
    convertReadableStreamToBuffer,
    getBricksDomainConfig
};
