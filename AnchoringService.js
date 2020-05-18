const URL_PREFIX = "/anchoring";
const anchorsStorage = "anchors";
function AnchoringService(server) {
    const path = require("path");
    require("./libs/flows/AnchorsManager");

    let storageFolder = path.join(server.rootFolder, anchorsStorage);
    $$.flow.start("AnchorsManager").init(storageFolder);

    function setHeaders(req, res, next) {
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Request methods you wish to allow
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

        // Request headers you wish to allow
        res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Content-Length, X-Content-Length');
        next();
    }

    function attachHashToAlias(req, res) {
        $$.flow.start("AnchorsManager").addAlias(req.params.fileId, req, (err, result) => {
            res.statusCode = 201;
            if (err) {
                res.statusCode = 500;

                if (err.code === 'EACCES') {
                    res.statusCode = 409;
                }
            }
            res.end();
        });
    }

    function getVersions(req, res) {
        $$.flow.start("AnchorsManager").readVersions(req.params.alias, (err, fileHashes) => {
            res.statusCode = 200;
            if (err) {
                console.error(err);
                res.statusCode = 404;
            }
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(fileHashes));
        });
    }

    server.use(`${URL_PREFIX}/*`, setHeaders);
    server.post(`${URL_PREFIX}/attachHashToAlias/:fileId`, attachHashToAlias);
    server.get(`${URL_PREFIX}/getVersions/:alias`, getVersions);
}

module.exports = AnchoringService;