const path = require('swarmutils').path;

function executeCommand(request, response, next) {
    console.log('runCommand received');
    console.log(request.body);
    console.log(request);
    console.log(request.url);
    console.log(request.headers.host);
    console.log(request.headers);

    console.log(request.connection.encrypted);
    //console.log(request.secure);
    const commandType = request.body.commandType;
    const getCmdConfig = require('./utils').getCmdConfig(commandType);
    const modulePath = path.join(process.env.PSK_ROOT_INSTALATION_FOLDER,'modules/psk-apihub/components/bricksLedger/commands', getCmdConfig);
    try {
            require(`${modulePath}`)(request.body , (err, result) => {
                if (err) {
                    return response.send(500, err);
                }

                // recording int BricksFabric
                // salveaza request.body in brickFabric
                //
                //
            //}
            //no err, then maybe we get something in result
            return response.send(201, result);
        });
    } catch (err)
    {
        console.log(err);
        return response.send(500, err);
    }


}


module.exports = { executeCommand };