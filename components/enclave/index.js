const loki = require("./lib/lokijs/src/lokijs.js");
const lfsa = require("./lib/lokijs/src/loki-fs-sync-adapter.js");
const adapter = new lfsa();

const openDSU = require("opendsu");
const w3cDID = openDSU.loadAPI("w3cdid");

function DefaultEnclave(server) {

    let initialized = false;

    let db = new loki(server.rootFolder, {
        adapter: adapter,
        autoload: true,
        autoloadCallback: () => { initialized = true; },
        autosave: true,
        autosaveInterval: 1000
    });

    w3cDID.createIdentity("key", undefined, process.env.REMOTE_ENCLAVE_SECRET, (err, didDocument) => {
        didDocument.subscribe((err, res) => {
            if (!initialized) return;

            if (err) {
                console.log(err);
            }
            try {
                const resObj = JSON.parse(res);
                const command = resObj.commandName;
                const params = resObj.params;
                const clientDID = params[params.length - 1];
                const result = JSON.stringify(this[command].apply(this, params));
                didDocument.sendMessage(result, clientDID, (err, res) => {
                    if (err) {
                        console.log(err);
                    }
                })
            }
            catch (err) {
                console.log(err);
            }
        });
    });

    this.insertRecord = function (forDID, tableName, pk, record) {
        let table = db.getCollection(tableName) || db.addCollection(tableName);
        const foundRecord = table.findOne({ 'pk': pk });
        if (foundRecord) {
            return `A record with pk ${pk} already exists in ${tableName}`;
        }
        let result;
        try {
            result = table.insert({ "pk": pk, ...record, "did": forDID, "__timestamp": Date.now() });
        } catch (err) {
            return err;
        }
        return result;
    }

    this.getRecord = function (forDID, tableName, pk) {
        let table = db.getCollection(tableName);
        if (!table) {
            return;
        }
        let result;
        try {
            result = table.findObject({ 'pk': pk });
        } catch (err) {
            return err;
        }

        return result;
    }

    this.getAllRecords = function (forDID, tableName) {
        let table = db.getCollection(tableName);
        if (!table) {
            return [];
        }

        let results;
        try {
            results = table.find();
        } catch (err) {
            return err;
        }
        return results
    }

}

module.exports = {
    DefaultEnclave
};
