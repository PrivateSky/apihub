function FilterCommand(params) {
    const defaultEnclave = require("../DefaultEnclave").getDefaultEnclave(params.storageFolder);
    const {forDID, tableName, query, sort, limit} = params;

    this.execute = (callback) => {
        defaultEnclave.filter(forDID, tableName, query, sort, limit, callback);
    }
}

const createFilterCommand = (params) => {
    return new FilterCommand(params);
}

module.exports = createFilterCommand;