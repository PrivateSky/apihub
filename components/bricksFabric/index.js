

function AutoSavePendingTransactions (flow, timeout, server) {
    flow.completeBlock(server);
    setTimeout (  () => {
         AutoSavePendingTransactions(flow, timeout, server);
    }, timeout);

}


function BricksFabric(server) {

    require('./strategies/BrickStorage.js');

    const bricksFabricStrategy = require('./utils').getBricksFabricStrategy();
    const rootFolder = require('./utils').getRootFolder();
    //options
    const noOfTran = bricksFabricStrategy.option.transactionsPerBlock;
    const strategyType = bricksFabricStrategy.name;

    //init strategy
    let flow = $$.flow.start(strategyType);
    flow.init(rootFolder,noOfTran);

    //resume if necessary
    flow.bootUp();

    const timeout = bricksFabricStrategy.option.timeout;
    setTimeout (  () => {
        //start forever loop starting in timeout
        AutoSavePendingTransactions(flow, timeout, server);
    }, timeout);

    const { URL_PREFIX } = require('./constants.js');
    const { responseModifierMiddleware, requestBodyJSONMiddleware } = require('../../utils/middlewares');
    const  storeTransaction  = require('./controllers')(flow, server);

    server.use(`${URL_PREFIX}/*`, responseModifierMiddleware);
    // request.body is populated with what data needs to be stored
    server.put(`${URL_PREFIX}/add`, requestBodyJSONMiddleware);

    server.put(`${URL_PREFIX}/add`, storeTransaction);
};






module.exports = BricksFabric;