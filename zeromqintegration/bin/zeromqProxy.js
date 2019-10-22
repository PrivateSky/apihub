const integration = require("../../../zmq_adapter");
const enableSignatureCheck = process.env.enable_signature_check || false;

require("../pingpongFork").enableLifeLine();

if(enableSignatureCheck){
    integration.createZeromqProxyNode(null, null, (channel, signature, callback)=>{
        if(callback){
            callback(null, true);
        }
    });
}else{
    integration.createZeromqProxyNode();
}
