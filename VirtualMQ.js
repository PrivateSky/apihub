const path = require("path");
const httpWrapper = require('./libs/http-wrapper');
const edfs = require("edfs");
const EDFSMiddleware = edfs.EDFSMiddleware;
const Server = httpWrapper.Server;
const Router = httpWrapper.Router;
const TokenBucket = require('./libs/TokenBucket');

const signatureHeaderName = process.env.vmq_signature_header_name || 'x-signature';

function VirtualMQ({listeningPort, rootFolder, sslConfig}, callback) {
	const port = listeningPort || 8080;
	const tokenBucket = new TokenBucket(600000, 1, 10);
	const CSB_storage_folder = "uploads";

	let bindFinish = (err)=>{
		if(err){
			console.log(err);
			if(callback){
				callback(err);
			}
			return;
		}

		console.log("Listening on port:", port);

		this.close = server.close;
		$$.flow.start("BricksManager").init(path.join(rootFolder, CSB_storage_folder), function (err, result) {
			if (err) {
				throw err;
			} else {
				console.log("BricksManager is using folder", result);
				registerEndpoints();
				if (callback) {
					callback();
				}
			}
		});
	};

	const server = new Server(sslConfig).listen(port, bindFinish);

	function registerEndpoints() {
		const router = new Router(server);
		router.use("/EDFS", (newServer) => {
			new EDFSMiddleware(newServer);
		});

		server.use(function (req, res, next) {
			res.setHeader('Access-Control-Allow-Origin', req.headers.origin || req.headers.host);
			res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
			res.setHeader('Access-Control-Allow-Headers', `Content-Type, Access-Control-Allow-Origin, ${signatureHeaderName}`);
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
			headers["Access-Control-Allow-Headers"] = `Content-Type, Access-Control-Allow-Origin, User-Agent, ${signatureHeaderName}`;
			res.writeHead(200, headers);
			res.end();
		});

		require("./ChannelsManager.js")(server);

		server.use(function (req, res) {
			res.statusCode = 404;
			res.end();
		});
	}
}

module.exports.createVirtualMQ = function(port, folder, sslConfig, callback){
	if(typeof sslConfig === 'function') {
		callback = sslConfig;
		sslConfig = undefined;
	}

	return new VirtualMQ({listeningPort:port, rootFolder:folder, sslConfig}, callback);
};

module.exports.VirtualMQ = VirtualMQ;
module.exports.getVMQRequestFactory = function(virtualMQAddress, zeroMQAddress) {
	const VMQRequestFactory = require('./VMQRequestFactory');

	return new VMQRequestFactory(virtualMQAddress, zeroMQAddress);
};

module.exports.getHttpWrapper = function() {
	return require('./libs/http-wrapper');
};
