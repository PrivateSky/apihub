function GetRecordCommand(params) {
    const defaultEnclave = require("../DefaultEnclave").getDefaultEnclave(params.storageFolder);
    const {forDID, tableName, pk} = params;

    this.execute = (callback) => {
        defaultEnclave.getRecord(forDID, tableName, pk, callback);
    }
}

const createGetRecordCommand = (params) => {
    return new GetRecordCommand(params);
}

module.exports = createGetRecordCommand;