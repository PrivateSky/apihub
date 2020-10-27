
const getBricksFabricStrategy = () => {
    const config = require("../../../config");
    return config.getConfig('endpointsConfig', 'bricksFabric', 'domainStrategies', 'default');
};

const getRootFolder = () => {
    // temporary location where we store the last hashlink
    const config = require("../../../config");
    return config.getConfig('endpointsConfig', 'bricksFabric').path;
};

const http = require('http');

const putBrickAsync = (data) =>
    new Promise ( (resolve, reject) => {


        const options = {
            hostname : 'localhost',
            port : 8080,
            path : '/bricks/put-brick',
            method : 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
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




module.exports.getBricksFabricStrategy = getBricksFabricStrategy;

module.exports.getRootFolder = getRootFolder;

module.exports.putBrickAsync = putBrickAsync;