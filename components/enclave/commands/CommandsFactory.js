const commands = {};
const commandsNames = require("./commandsNames");
//db commands
const createInsertRecordCommand = require("./db/InsertRecordCommand");
const createUpdateRecordCommand = require("./db/UpdateRecordCommand");
const createGetRecordCommand = require("./db/GetRecordCommand");
const createDeleteRecordCommand = require("./db/DeleteRecordCommand");
const createFilterCommand = require("./db/FilterCommand");

//queue commands
const createAddInQueueCommand = require("./queue/AddInQueueCommand");
const createQueueSizeCommand = require("./queue/QueueSizeCommand");
const createListQueueCommand = require("./queue/ListQueueCommand");
const createGetObjectFromQueueCommand = require("./queue/GetObjectFromQueueCommand");
const createDeleteObjectFromQueueCommand = require("./queue/DeleteObjectFromQueueCommand");

function CommandsFactory() {

}

CommandsFactory.prototype.registerCommand = (commandName, command) => {
    commands[commandName] = command;
};

CommandsFactory.prototype.createCommand = (commandName, params) => {
    return commands[commandName](params);
};

//Registering db commands
CommandsFactory.prototype.registerCommand(commandsNames.INSERT_RECORD, createInsertRecordCommand);
CommandsFactory.prototype.registerCommand(commandsNames.UPDATE_RECORD, createUpdateRecordCommand);
CommandsFactory.prototype.registerCommand(commandsNames.GET_RECORD, createGetRecordCommand);
CommandsFactory.prototype.registerCommand(commandsNames.DELETE_RECORD, createDeleteRecordCommand);
CommandsFactory.prototype.registerCommand(commandsNames.FILTER_RECORDS, createFilterCommand);

//Registering queue commands
CommandsFactory.prototype.registerCommand(commandsNames.ADD_IN_QUEUE, createAddInQueueCommand);
CommandsFactory.prototype.registerCommand(commandsNames.QUEUE_SIZE, createQueueSizeCommand);
CommandsFactory.prototype.registerCommand(commandsNames.LIST_QUEUE, createListQueueCommand);
CommandsFactory.prototype.registerCommand(commandsNames.GET_OBJECT_FROM_QUEUE, createGetObjectFromQueueCommand);
CommandsFactory.prototype.registerCommand(commandsNames.DELETE_OBJECT_FROM_QUEUE, createDeleteObjectFromQueueCommand);

module.exports = new CommandsFactory();