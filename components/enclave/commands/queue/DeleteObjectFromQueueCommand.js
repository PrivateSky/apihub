function DeleteObjectFromQueueCommand(params) {
    const defaultEnclave = require("../DefaultEnclave").getDefaultEnclave(params.storageFolder);
    const {forDID, queueName, hash} = params;

    this.execute = (callback) => {
        defaultEnclave.getObjectFromQueue(forDID, queueName, hash, callback);
    }
}

const createDeleteObjectFromQueueCommand = (params) => {
    return new DeleteObjectFromQueueCommand(params);
}

module.exports = createDeleteObjectFromQueueCommand;