const fs = require("fs");
const path = require("path");

const getLokiEnclaveFacade = (storageFile) => {
    if(typeof $$.lokiEnclaveFacade === "undefined") {
        try {
            fs.accessSync(path.dirname(storageFile));
        } catch (e) {
            fs.mkdirSync(path.dirname(storageFile), {recursive: true});
        }
        const LokiEnclaveFacade = require("default-enclave");
        $$.lokiEnclaveFacade = new LokiEnclaveFacade(storageFile);
    }

    return $$.lokiEnclaveFacade;
}

module.exports = {
    getLokiEnclaveFacade
}
