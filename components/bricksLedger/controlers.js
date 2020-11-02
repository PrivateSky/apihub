const path = require('swarmutils').path;

function createHandler(server) {

    return function executeCommand(request, response, next) {
        console.log('runCommand received');

        const commandType = request.body.commandType;
        const getCmdConfig = require('./utils').getCmdConfig(commandType);
        //we need to provide full path to the file, relative path will generate not found module error
        const modulePath = path.join(process.env.PSK_ROOT_INSTALATION_FOLDER,'modules/psk-apihub/components/bricksLedger/commands', getCmdConfig);
        try {
            require(`${modulePath}`)(request.body , server, (err, result) => {
                if (err) {
                    console.log('command controler error. err :', err);
                    return response.send(500, err);
                }
                console.log("completed executedCommand", result);
                //no err, then maybe we get something in result
                return response.send(201, result);
            });
        } catch (err)
        {
            console.log("command controller catch error. err :",err);
            return response.send(500, err);
        }


    }

}


module.exports = createHandler;