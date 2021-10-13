const getDefaultEnclave = (storageFolder) => {
    if (!$$.defaultEnclave) {
        const DefaultEnclave = require("default-enclave");
        $$.defaultEnclave = new DefaultEnclave(storageFolder)
    }

    return $$.defaultEnclave;
}

module.exports = {
    getDefaultEnclave
}