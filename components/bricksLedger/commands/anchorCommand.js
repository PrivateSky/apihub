module.exports = function doAnchor(jsonparam, server, callback){


    const bfrabricBody = JSON.stringify(jsonparam);
    const bfabricMethod = "PUT";
    const bfabricPath = require("../../bricksFabric/constants").URL_PREFIX + "/add";
    const bfabricHeaders = {
        'Content-Type': 'application/json',
        'Content-Length': bfrabricBody.length
    };

    try {
        server.makeLocalRequest(bfabricMethod, bfabricPath, bfrabricBody, bfabricHeaders, (err, result) => {
            if (err) {
                console.log(err);
            }
        });
    } catch (err)
    {
        console.log("anchor command", err);
    }
    //console.log('called doAnchor');
   // console.log('data received : ', jsonparam);

    callback(undefined,"doAnchor finished.");
    //console.log('called end doAnchor method');
};