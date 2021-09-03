function ListQueueCommand(params) {
    const defaultEnclave = require("../DefaultEnclave").getDefaultEnclave(params.storageFolder);
    const {forDID, queueName, sortAfterInsertTime, onlyFirstN} = params;

    this.execute = (callback) => {
        defaultEnclave.listQueue(forDID, queueName,  sortAfterInsertTime, onlyFirstN, callback);
    }
}

const createListQueueCommand = (params) => {
    return new ListQueueCommand(params);
}

module.exports = createListQueueCommand;