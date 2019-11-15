const path = require("path");

require("../../../../psknode/bundles/pskruntime");
require("../../../../psknode/bundles/virtualMQ");

const VirtualMQ = require("../../index");
const doubleCheck = require('../../../double-check');
const assert = doubleCheck.assert;

function getPort(){
    return Math.floor((Math.random() * 55000) + 2000);
}

let port = getPort();
let pubP = getPort();
let subP = getPort();

process.env.vmq_zeromq_forward_address = `tcp://127.0.0.1:${pubP}`;
process.env.vmq_zeromq_sub_address = `tcp://127.0.0.1:${subP}`;
process.env.vmq_zeromq_pub_address = `tcp://127.0.0.1:${pubP}`;

function createServer(folder, callback) {
    const server = VirtualMQ.createVirtualMQ(port, folder, undefined, (err, res) => {
        if (err) {
            console.log("Failed to create VirtualMQ server on port ", port, "Trying again...");
                port = getPort();
                createServer(folder, callback);
        } else {
            console.log("Server ready and available on port ", port);
            callback(server, port);
        }
    });
}


module.exports.createInfrastructureTest = function(name, time2Expire, hostname, callback){
    assert.callback(name, (finish)=>{
        doubleCheck.createTestFolder("vmq", (err, folder)=>{
            if(!err){
                process.env.vmq_channel_storage = path.join(folder, "tmp");
                createServer(process.env.vmq_channel_storage, (server, port, ...args)=>{
                    let apis = VirtualMQ.getVMQRequestFactory(`http:${hostname}:${port}`);
                    callback(null, apis, finish);
                });
            }else{
                callback(err);
            }
        });
    }, time2Expire || 10000);
};

