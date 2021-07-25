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
    this.makeLocalRequest = function (method,path, body,headers, callback)
    {
        if (typeof headers === "function")
        {
            callback = headers;
            headers = undefined;
        }

        if (typeof body === "function")
        {
            callback = body;
            headers = undefined;
            body = undefined;
        }

        const protocol =  require(this.protocol);
        const options = {
            hostname : 'localhost',
            port : server.address().port,
            path,
            method,
            headers
        };
        const req = protocol.request(options, response => {

            if (response.statusCode < 200 || response.statusCode >= 300) {

                return callback(new Error("Failed to execute command. StatusCode " + response.statusCode));
            }
            let data = [];
            response.on('data', chunk => {
                data.push(chunk);
            });

            response.on('end', () => {
                try {
                    const bodyContent = $$.Buffer.concat(data).toString();
                    console.log('resolve will be called. bodyContent received : ', bodyContent);
                    return callback(undefined,bodyContent);
                } catch (err) {
                    return callback(err);
                }
            });
        });

        req.on('error', err => {
            console.log("reject will be called. err :", err);
            return callback(err);
        });

        if(body) {
            req.write(body);
        }
        req.end();
    };

    this.makeLocalRequestAsync = async function(method, path, body, headers) {
        try {
            const makeLocalRequest = $$.promisify(this.makeLocalRequest.bind(this));
            let response = await makeLocalRequest(method, path, body, headers);
    
            if (response) {
                try {
                    response = JSON.parse(response);
                } catch (error) {
                    // the response isn't a JSON so we keep it as it is
                }           
            }
    
            return response;
        } catch (error) {
            // console.warn(`Failed to call ${method} on '${path}'`, error);
            throw error;
        }
    }

    /* INTERNAL METHODS */

    function _initServer(sslConfig) {
        let server;
        if (sslConfig) {
             server = https.createServer(sslConfig, middleware.go);
             server.protocol = "https";
        } else {
            server = http.createServer(middleware.go);
            server.protocol = "http";
        }

        return server;
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