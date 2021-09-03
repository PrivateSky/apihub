function AddInQueueCommand(params) {
    const defaultEnclave = require("../DefaultEnclave").getDefaultEnclave(params.storageFolder);
    const {forDID, queueName, encryptedObject} = params;

    this.execute = (callback) => {
        defaultEnclave.addInQueue(forDID, queueName, encryptedObject, callback);
    }
}

const createAddInQueueCommand = (params) => {
    return new AddInQueueCommand(params);
}

module.exports = createAddInQueueCommand;