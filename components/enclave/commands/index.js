const createCommand = (commandName, ...args) => {
    const storageFolder = args.pop();
    const defaultEnclave = require("./DefaultEnclave").getDefaultEnclave(storageFolder);

    return {
        execute(callback) {
            args.push(callback)
            defaultEnclave[commandName](...args);
        }
    }
}

module.exports = {
    createCommand
};

