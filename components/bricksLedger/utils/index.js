function getCmdConfig(commandType)
{
    const config = require('../../../config');
    const cfg = config.getConfig('endpointsConfig', 'bricksLedger');
    const cmdConfig = 'do' + capitalize(commandType);
    console.log(cmdConfig);
    console.log(cfg[cmdConfig]);
    return cfg[cmdConfig];

}


function capitalize(str){
    return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = {getCmdConfig};