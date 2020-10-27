
async function storeAnchor (request, response, callback) {

    console.log('store anchored called');

    //get request info
    const anchorId = request.params.anchorId;

    const hashnew = request.body.hash.new;
    const hashlast = request.body.hash.last;

    const anchorData = {
        anchorId : anchorId,
        hash : {
            last: hashlast,
            new : hashnew
        }
    };

    console.log(anchorData);

    const bricksFabricStrategy = require('./utils').getBricksFabricStrategy();
    const strategyType = bricksFabricStrategy.name;

    //strategy is already booted up
    await $$.flow.start(strategyType).storeData(anchorData, callback);



    response.send(201);

}




module.exports = {storeAnchor};