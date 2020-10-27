
const timeout = require('./utils').getBricksFabricStrategy().option.timeout;
const strategy = require('./utils').getBricksFabricStrategy().name;

async function AutoSavePendingTransactions () {

    console.log('timeout handler executed !');

    await $$.flow.start(strategy).completeBlock();

    console.log('timeout handler execution finished !');

    setTimeout ( async () => {

        await AutoSavePendingTransactions();
    }, timeout);

}


setTimeout ( async () => {
    //start forever loop starting in timeout
    await AutoSavePendingTransactions();
}, timeout)


function BricksFabric(server) {

    console.log('init bricksFabric');

    require('./strategies/BrickStorage.js');

    const bricksFabricStrategy = require('./utils').getBricksFabricStrategy();
    const rootFolder = require('./utils').getRootFolder();
    //options
    const noOfTran = bricksFabricStrategy.option.transactionsPerBlock;
    const strategyType = bricksFabricStrategy.name;

    //init strategy
    $$.flow.start(strategyType).init(rootFolder,noOfTran);

    //resume if necessary
    $$.flow.start(strategyType).bootUp();

    const { URL_PREFIX } = require('./constants.js');
    const { responseModifierMiddleware, requestBodyJSONMiddleware } = require('../../utils/middlewares');
    const { storeAnchor } = require('./controllers');

    server.use(`${URL_PREFIX}/*`, responseModifierMiddleware);
    // request.body is populated
    // we will have anchor json in there
    server.put(`${URL_PREFIX}/add/:anchorId`, requestBodyJSONMiddleware);

    server.put(`${URL_PREFIX}/add/:anchorId`, async (request, response, next) => await storeAnchor(request, response, next));

    console.log('middleware bricksFabric initialized');
    console.log(`listening to ${URL_PREFIX}/add/:anchorId`);
};






module.exports = BricksFabric;