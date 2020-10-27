const MiddlewareRegistry = require('./MiddlewareRegistry');
const http = require('http');
const https = require('https');


function Server(sslOptions) {
    const middleware = new MiddlewareRegistry();
    const server = _initServer(sslOptions);


    this.use = function use(url, callback) {
        //TODO: find a better way
        if (arguments.length >= 2) {
            middleware.use(url, callback);
        } else if (arguments.length === 1) {
            callback = url;
            middleware.use(callback);
        }

    };


    this.get = function getReq(reqUrl, reqResolver) {
        middleware.use("GET", reqUrl, reqResolver);
    };

    this.post = function postReq(reqUrl, reqResolver) {
        middleware.use("POST", reqUrl, reqResolver);
    };

    this.put = function putReq(reqUrl, reqResolver) {
        middleware.use("PUT", reqUrl, reqResolver);
    };

    this.delete = function deleteReq(reqUrl, reqResolver) {
        middleware.use("DELETE", reqUrl, reqResolver);
    };

    this.options = function optionsReq(reqUrl, reqResolver) {
        middleware.use("OPTIONS", reqUrl, reqResolver);
    };

    this.protocol = function getProtocol(){
        return (sslOptions) ? 'https' : 'http';
    };
    /* INTERNAL METHODS */

    function _initServer(sslConfig) {
        if (sslConfig) {
            return https.createServer(sslConfig, middleware.go);
        } else {
            return http.createServer(middleware.go);
        }
    }

    return new Proxy(this, {
       get(target, prop, receiver) {
           if(typeof target[prop] !== "undefined") {
               return target[prop];
           }

           if(typeof server[prop] === "function") {
               return function(...args) {
                   server[prop](...args);
               }
           } else {
               return server[prop];
           }
       }
    });
}

module.exports = Server;