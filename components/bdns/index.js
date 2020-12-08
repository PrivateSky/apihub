function BDNS(server) {
    const URL_PREFIX = "/bdns";
    const {headersMiddleware} = require('../../utils/middlewares');

    let bdnsCache;
    try{
        const fs = require("fs");
        const path = require("path");
        const bdnsHostsPath = path.join(server.rootFolder, "external-volume", "config", "bdns.hosts")

        bdnsCache = fs.readFileSync(bdnsHostsPath).toString();
    }catch(e){
        throw e;
    }

    function bdnsHandler(request, response, next) {
        response.setHeader('content-type', 'application/json');
        response.setHeader('Cache-control', 'max-age=0'); // set brick cache expiry to 1 year
        //ensure we support both signatures for put-brick. With and without domain. Fallback to 'default'.

        if (typeof bdnsCache !== "undefined") {
            response.setHeader('Content-Type', 'application/json');
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