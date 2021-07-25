const { clone } = require("../../utils");

function convertReadableStreamToBuffer(readStream, callback) {
    let buffers = [];

    readStream.on('data', (chunk) => buffers.push(chunk));

    readStream.on('error', (error) => callback(error));

    readStream.on('end', () => callback(undefined, $$.Buffer.concat(buffers)));
}

function getBricksDomainConfig(domain) {
    const config = require("../../config");
    const domainConfiguration = config.getDomainConfig(domain);
    if (!domainConfiguration) {
        return;
    }

    let domainConfig = domainConfiguration.bricking;

    domainConfig = clone(domainConfig || {});
    domainConfig.path = require("path").join(config.getConfig("externalStorage"), `domains/${domain}/brick-storage`);

    return domainConfig;
}

module.exports = {
    convertReadableStreamToBuffer,
    getBricksDomainConfig
};
