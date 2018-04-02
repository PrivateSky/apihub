const Middleware = require('./Middleware');
const http = require('http');

function Server() {
    const middleware = new Middleware();
    const server = http.createServer(middleware.go);

    this.listen = function listen(port) {
        server.listen(port);
        return this;
    };

    this.use = function use(url, callback) {
        //TODO: find a better way
        if (arguments.length >= 2) {
            middleware.use(url, callback);
        } else if (arguments.length === 1) {
            callback = url;
            middleware.use(callback);
        }

    };

    this.close = function (callback) {
        server.close(callback);
    };

    this.get = function getReq(reqUrl, reqResolver) {
        middleware.use("GET", reqUrl, reqResolver);
    };

    this.post = function postReq(reqUrl, reqResolver) {
        middleware.use("POST", reqUrl, reqResolver)
    };

    this.put = function putReq(reqUrl, reqResolver) {
        middleware.use("PUT", reqUrl, reqResolver)
    };

    this.delete = function deleteReq(reqUrl, reqResolver) {
        middleware.use("DELETE", reqUrl, reqResolver)
    };
}

module.exports = Server;