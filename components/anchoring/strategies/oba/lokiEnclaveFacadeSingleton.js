const fs = require("fs");

const getLokiEnclaveFacade = (storageFolder) => {
    if(typeof $$.lokiEnclaveFacade === "undefined") {
        try {
            fs.accessSync(storageFolder);
        } catch (e) {
            fs.mkdirSync(storageFolder, {recursive: true});
        }
        const LokiEnclaveFacade = require("default-enclave");
        $$.lokiEnclaveFacade = new LokiEnclaveFacade(storageFolder);
    }

    return $$.lokiEnclaveFacade;
}

module.exports = {
    getLokiEnclaveFacade
}
