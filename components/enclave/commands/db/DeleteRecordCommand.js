function DeleteRecordCommand(params) {
    const defaultEnclave = require("../DefaultEnclave").getDefaultEnclave(params.storageFolder);
    const {forDID, tableName, pk} = params;

    this.execute = (callback) => {
        defaultEnclave.deleteRecord(forDID, tableName, pk, callback);
    }
}

const createDeleteRecordCommand = (params) => {
    return new DeleteRecordCommand(params);
}

module.exports = createDeleteRecordCommand;