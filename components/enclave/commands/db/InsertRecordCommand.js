function InsertRecordCommand(params) {
    const defaultEnclave = require("../DefaultEnclave").getDefaultEnclave(params.storageFolder);
    const {forDID, tableName, pk, plainRecord, encryptedRecord} = params;

    this.execute = (callback) => {
        defaultEnclave.insertRecord(forDID, tableName, pk, plainRecord, callback);
    }
}

const createInsertRecordCommand = (params) => {
    return new InsertRecordCommand(params);
}

module.exports = createInsertRecordCommand;