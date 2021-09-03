function UpdateRecordCommand(params) {
    const defaultEnclave = require("../DefaultEnclave").getDefaultEnclave(params.storageFolder);
    const {forDID, tableName, pk, plainRecord, encryptedRecord} = params;

    this.execute = (callback) => {
        defaultEnclave.updateRecord(forDID, tableName, pk, plainRecord, callback);
    }
}

const createUpdateRecordCommand = (params) => {
    return new UpdateRecordCommand(params);
}

module.exports = createUpdateRecordCommand;