const getLokiEnclaveFacade = (storageFolder) => {
    if (!$$.LokiEnclaveFacade) {
        const LokiEnclaveFacade = require("loki-enclave-facade");
        $$.LokiEnclaveFacade = new LokiEnclaveFacade(storageFolder)
    }

    return $$.LokiEnclaveFacade;
}

module.exports = {
    getLokiEnclaveFacade
}