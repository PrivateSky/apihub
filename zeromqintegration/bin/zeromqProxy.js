const integration = require("./../index");
const enableSignatureCheck = process.env.enable_signature_check || false;

if(enableSignatureCheck){
    integration.createZeromqProxyNode(null, null, (channel, signature, callback)=>{
        if(callback){
            callback(null, true);
        }
    });
}else{
    integration.createZeromqProxyNode();
}
