const http = require('http');


// requestToCommand (data {  jSON.... }, request, (err, res) => {
// callback(err, res.body) <--- de ascuns in requestCommand
// }) ) - apel syncron


///jsonData will contain the json required to execute the command
// the jsonData will be needed to be build only one time, no matter the strategy
// jsonData { "data" : "information from body and query parameters"
//             "option" : "information regarding options from config for the strategy"
//          }
// commandType
//eg.
//const jsonsample = {
//    "commandType" : commandType,
//    "data" : jsonData
//}

const requestToCommand = async (jsonData, commandType, callback) => {
    await reqcmd(jsonData, commandType)
        .then(result => callback(undefined, result))
        .catch(err => callback(err, undefined));
};

const reqcmd  = (jsonData, commandType) =>
    new Promise ( (resolve, reject) => {

        // command endpoint is located in out context, so we can use localhost
        // if the command endpoint is located elsewhere, it should be configured in settings somewhere
        // we assume that request on http for https will generate a redirect

        //run command body
        const runCommandBody = {
            "commandType" : commandType,
            "data" : jsonData
        };
        //build path
        const runCommandPath = require('../bricksLedger/constants').URL_PREFIX + '/runCommand';
        //run Command method
        const runCmdMethod = 'POST';
        // run Command headers
        const runCmdHeaders = {
            'Content-Type': 'application/json',
            'Content-Length': runCommandBody.length
        };
        // get port from config file
        const runCommandPort = require('../../config').getConfig('port');
        const options = {
            hostname : 'localhost',
            port : runCommandPort,
            path : runCommandPath,
            method : runCmdMethod,
            headers: runCmdHeaders
        };

        const req = http.request(options, response => {
            console.log ('response status code', response.statusCode);
            let data = [];
            response.on('data', chunk => {
                data.push(chunk);
            });

            response.on('end', () => {
                const bodyContent = Buffer.concat(data).toString();
                console.log('bodyContent received : ', bodyContent);
                return resolve(bodyContent);
            });
        });

        req.on('error', err => reject(err));

        req.write(data);
        req.end();


    });


module.exports = {requestToCommand}
