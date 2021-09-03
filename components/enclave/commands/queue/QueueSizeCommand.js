function QueueSizeCommand(params) {
    const defaultEnclave = require("../DefaultEnclave").getDefaultEnclave(params.storageFolder);
    const {forDID, queueName} = params;

    this.execute = (callback) => {
        defaultEnclave.queueSize(forDID, queueName, callback);
    }
}

const createQueueSizeCommand = (params) => {
    return new QueueSizeCommand(params);
}

module.exports = createQueueSizeCommand;