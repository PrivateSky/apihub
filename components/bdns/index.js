function BDNS(server) {
    const URL_PREFIX = "/bdns";
    const {headersMiddleware} = require('../../utils/middlewares');

    let bdnsCache;

    let init_process_runned = false;
    function initialize(){
        if(init_process_runned){
           return true;
        }
        init_process_runned = true;
        try{
            const fs = require("fs");
            const path = require("path");
            //TODO: we should use the process.env.PSK_CONFIG_LOCATION variable instead of the hard coding...
            const bdnsHostsPath = path.join(server.rootFolder, "external-volume", "config", "bdns.hosts")

            bdnsCache = fs.readFileSync(bdnsHostsPath).toString();
        }catch(e){
            throw e;
        }
    }

    function bdnsHandler(request, response, next) {
        initialize();
        if (typeof bdnsCache !== "undefined") {
            response.setHeader('content-type', 'application/json');
            response.statusCode = 200;
            response.end(bdnsCache);
        }else{
            console.log("Bdns config not available at this moment. A 404 response will be sent.");
            response.statusCode = 404;
            return response.end('BDNS hosts not found');
        }
    }

    server.use(`${URL_PREFIX}/*`, headersMiddleware);
    server.get(URL_PREFIX, bdnsHandler);
}

module.exports = BDNS;