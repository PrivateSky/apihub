const getDefaultEnclave = (storageFolder) => {
    if (typeof $$.defaultEnclave === "undefined") {
        const DefaultEnclave = require("default-enclave");
        $$.defaultEnclave = new DefaultEnclave(storageFolder)
    }

    return $$.defaultEnclave;
}

module.exports = {
    getDefaultEnclave
}