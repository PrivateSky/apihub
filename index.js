const path = require("path");
const httpWrapper = require('./libs/http-wrapper');
const Server = httpWrapper.Server;
const Router = httpWrapper.Router;
const TokenBucket = require('./libs/TokenBucket');
const START_TOKENS = 6000000;

const signatureHeaderName = process.env.vmq_signature_header_name || 'x-signature';

function HttpServer({listeningPort, rootFolder, sslConfig}, callback) {
	const port = listeningPort || 8080;
	const tokenBucket = new TokenBucket(START_TOKENS, 1, 10);

	const server = new Server(sslConfig);
	server.rootFolder = rootFolder;
	server.listen(port, (err) => {
		if(err){
			console.log(err);
			if(callback){
				callback(err);
			}
		}
	});

	server.on('listening', bindFinished);

	function bindFinished(err){
		if(err) {
			console.log(err);
			if (callback) {
				callback(err);
			}
			return;
		}

		registerEndpoints(callback);
	}

	function registerEndpoints(callback) {
		server.use(function (req, res, next) {
			res.setHeader('Access-Control-Allow-Origin', req.headers.origin || req.headers.host);
			res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
			res.setHeader('Access-Control-Allow-Headers', `Content-Type, Content-Length, X-Content-Length, Access-Control-Allow-Origin, ${signatureHeaderName}`);
			res.setHeader('Access-Control-Allow-Credentials', true);
			next();
		});

        server.use(function (req, res, next) {
            const ip = res.socket.remoteAddress;
            tokenBucket.takeToken(ip, tokenBucket.COST_MEDIUM, function(err, remainedTokens) {
            	res.setHeader('X-RateLimit-Limit', tokenBucket.getLimitByCost(tokenBucket.COST_MEDIUM));
            	res.setHeader('X-RateLimit-Remaining', tokenBucket.getRemainingTokenByCost(remainedTokens, tokenBucket.COST_MEDIUM));

            	if(err) {
            		if (err === TokenBucket.ERROR_LIMIT_EXCEEDED) {
						res.statusCode = 429;
					} else {
						res.statusCode = 500;
					}

            		res.end();
            		return;
            	}

            	next();
            });
        });

		server.options('/*', function (req, res) {
			const headers = {};
			// IE8 does not allow domains to be specified, just the *
			headers["Access-Control-Allow-Origin"] = req.headers.origin;
			// headers["Access-Control-Allow-Origin"] = "*";
			headers["Access-Control-Allow-Methods"] = "POST, GET, PUT, DELETE, OPTIONS";
			headers["Access-Control-Allow-Credentials"] = true;
			headers["Access-Control-Max-Age"] = '3600'; //one hour
			headers["Access-Control-Allow-Headers"] = `Content-Type, Content-Length, X-Content-Length, Access-Control-Allow-Origin, User-Agent, ${signatureHeaderName}`;
			res.writeHead(200, headers);
			res.end();
		});

		require("./ChannelsManager.js")(server);
		require("./FilesManager.js")(server);
		require("edfs-middleware").getEDFSMiddleware(server);

		setTimeout(function(){
			//allow other endpoints registration before registering fallback handler
			server.use(function (req, res) {
				res.statusCode = 404;
				res.end();
			});
			if(callback){
				return callback();
			}
		}, 100);
	}
	return server;
}

module.exports.createVirtualMQ = function(port, folder, sslConfig, callback){
	if(typeof sslConfig === 'function') {
		callback = sslConfig;
		sslConfig = undefined;
	}

	return new HttpServer({listeningPort:port, rootFolder:folder, sslConfig}, callback);
};

module.exports.getVMQRequestFactory = function(virtualMQAddress, zeroMQAddress) {
	const VMQRequestFactory = require('./VMQRequestFactory');

	return new VMQRequestFactory(virtualMQAddress, zeroMQAddress);
};

module.exports.getHttpWrapper = function() {
	return require('./libs/http-wrapper');
};
