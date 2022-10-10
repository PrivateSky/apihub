let keySSIApis = require("opendsu").loadAPI("keyssi");

function generateSeedSSI(){
    const domain = 'default';
    return keySSIApis.createSeedSSI(domain);
}

function generateConstSSI(){
    const domain = 'default';
    return keySSIApis.createConstSSI(domain);
}

async function getAnchorId(seedSSI){
    return await $$.promisify(seedSSI.getAnchorId)();
}

async function getSignedHashLink(seedSSI, previousSignHashLinkId){
    const domain = 'default';
    let anchorSSI = keySSIApis.parse(await getAnchorId(seedSSI));
    let previousSignHashLinkSSI = null;
    if (previousSignHashLinkId){
        previousSignHashLinkSSI = keySSIApis.parse(previousSignHashLinkId);
    }
    const timestamp = Date.now();

    const dummy = keySSIApis.createSignedHashLinkSSI(domain, "HASH1", timestamp, "signature", seedSSI.getVn());
    let dataToSign = dummy.getDataToSign(anchorSSI,previousSignHashLinkSSI);

    let signature = await $$.promisify(seedSSI.sign)(dataToSign);
    const signedHashLinkSSI = keySSIApis.createSignedHashLinkSSI(domain, "HASH1", timestamp, signature, seedSSI.getVn());
    return signedHashLinkSSI.getIdentifier();
}


function getHashLink(constSSI){
    const domain = 'default';
    return keySSIApis.createHashLinkSSI(domain,'some hash data', constSSI.getVn(),'hint').getIdentifier();
}



module.exports = {
    getAnchorId,
    getSignedHashLink,
    generateSeedSSI,
    generateConstSSI,
    getHashLink
}
