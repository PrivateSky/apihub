
require("../../../../psknode/bundles/pskruntime");
require("../../../../psknode/bundles/consoleTools");
require("../../../../psknode/bundles/virtualMQ");
const VirtualMQ = require('virtualmq');
const path = require('swarmutils').path;
const interact = require('interact');

const PORT = 8080;
const tempFolder = path.resolve('../../tmp');
const CHANNEL_NAME = 'testChannel';
const url = `http://127.0.0.1:${PORT}`;


const flow = $$.flow.describe('VirtualMQTest', {
    init: function () {
        // this.cb = callback;

        const rmis = interact.createRemoteInteractionSpace('node1', url, 'localhost/agent/example');

        rmis.startSwarm('notifier', 'init', '123');

        // $$.remote['node1'].on("notifier", "init", (err, res) => {
        //     if (err) {
        //         throw err;
        //     }
        //
        //     console.log("public key=", res.meta.args[0]);
        // });
    }
})();

flow.init();

