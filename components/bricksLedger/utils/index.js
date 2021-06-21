function getCmdConfig(commandType)
{
    const config = require('../../../config');
    const cfg = config.getConfig('componentsConfig', 'bricksLedger');
    const cmdConfig = 'do' + capitalize(commandType);
    return cfg[cmdConfig];

}


function capitalize(str){
    return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = {getCmdConfig};