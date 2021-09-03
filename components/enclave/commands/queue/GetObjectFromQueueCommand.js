function GetObjectFromQueueCommand(params) {
    const defaultEnclave = require("../DefaultEnclave").getDefaultEnclave(params.storageFolder);
    const {forDID, queueName, hash} = params;

    this.execute = (callback) => {
        defaultEnclave.getObjectFromQueue(forDID, queueName, hash, callback);
    }
}

const createGetObjectFromQueueCommand = (params) => {
    return new GetObjectFromQueueCommand(params);
}

module.exports = createGetObjectFromQueueCommand;