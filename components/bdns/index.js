function BDNS(server) {
    const URL_PREFIX = "/bdns";
    const {headersMiddleware} = require('../../utils/middlewares');

    server.use(`${URL_PREFIX}/*`, headersMiddleware);

    try{
        const fs = require("fs");
        const path = require("path");
        const bdnsHostsPath = path.join(server.rootFolder, "external-volume", "config", "bdns.hosts")
        let bdnsCache;
        const bdns = require("opendsu").loadApi("bdns");
        bdnsCache = fs.readFileSync(bdnsHostsPath).toString();
        bdns.setBDNSHosts(bdnsCache);

        function bdnsHandler(request, response, next) {
            response.setHeader('content-type', 'application/json');
            response.setHeader('Cache-control', 'max-age=0'); // set brick cache expiry to 1 year
            //ensure we support both signatures for put-brick. With and without domain. Fallback to 'default'.

            if (typeof bdnsCache !== "undefined") {
                response.setHeader('Content-Type', 'application/json');
                response.statusCode = 200;
                response.end(bdnsCache);
            }else{
                console.log("Bdns config not found");
                response.statusCode = 404;
                return response.end('BDNS hosts not found');
            }
        }
    }catch(e){
        throw e;
    }


    server.get(URL_PREFIX, bdnsHandler);
}

module.exports = BDNS;