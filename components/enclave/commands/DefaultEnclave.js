const getDefaultEnclave = (storageFolder) => {
    const DefaultEnclave = require("default-enclave");
    return new DefaultEnclave(storageFolder)
}

module.exports = {
    getDefaultEnclave
}