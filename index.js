const httpWrapper = require('./libs/http-wrapper');
const Server = httpWrapper.Server;
const TokenBucket = require('./libs/TokenBucket');
const START_TOKENS = 6000000;

const LoggerMiddleware = require('./middlewares/logger');
const AuthorisationMiddleware = require('./middlewares/authorisation');
const IframeHandlerMiddleware = require('./middlewares/iframeHandler');

function HttpServer({ listeningPort, rootFolder, sslConfig }, callback) {
	if (typeof $$.flows === "undefined") {
		require('callflow').initialise();
	}
	//next require lines are only for browserify build purpose
	// Remove mock
	require('./components/bricking');
	require('./components/anchoring');
	require('./components/channelManager');
	require('./components/bdns');
	require('./components/fileManager');
	require('./components/bricksLedger');
	require('./components/bricksFabric');
	require('./components/staticServer');
	require('./components/mqManager');
	require('./components/keySsiNotifications');
	//end

	const port = listeningPort || 8080;
	const tokenBucket = new TokenBucket(START_TOKENS, 1, 10);

	const conf =  require('./config').getConfig();
	const server = new Server(sslConfig);
	server.rootFolder = rootFolder;

	checkPortInUse(port, sslConfig, (err, status) => {
		if (status === true) {
			throw Error(`Port ${port} is used by another server.`);
		}

        server.setTimeout(10 * 60 * 1000);
		server.listen(port, conf.host, (err) => {
			if (err) {
				console.log(err);
				if (callback) {
					return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to listen on port <${port}>`, err));
				}
			}
		});
	});

	server.on('listening', bindFinished);
	server.on('error', bindErrorHandler);

	function checkPortInUse(port, sslConfig, callback) {
		let commType = 'http';
		if (typeof sslConfig !== 'undefined') {
			commType += 's';
		}

		console.log(`Checking if port ${port} is available. Please wait...`);

		require(commType).request({ port }, (res) => {
			callback(undefined, true);
		}).on('error', (err) => {
			callback(undefined, false);
		});
	}

	function bindErrorHandler(error) {
		if (error.code === 'EADDRINUSE') {
			server.close();
			if (callback) {
				return callback(error);
			}
			throw error;
		}
	}

	function bindFinished(err) {
		if (err) {
			console.log(err);
			if (callback) {
				return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to bind on port <${port}>`, err));
			}
			return;
		}

		registerEndpoints(callback);
	}

	function registerEndpoints(callback) {
		server.use(function (req, res, next) {
			res.setHeader('Access-Control-Allow-Origin', req.headers.origin || req.headers.host);
			res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
			res.setHeader('Access-Control-Allow-Headers', `Content-Type, Content-Length, X-Content-Length, Access-Control-Allow-Origin, ${conf.endpointsConfig.virtualMQ.signatureHeaderName}`);
			res.setHeader('Access-Control-Allow-Credentials', true);
			next();
		});

		if (conf.preventRateLimit !== true) {
			server.use(function (req, res, next) {
				const ip = res.socket.remoteAddress;
				tokenBucket.takeToken(ip, tokenBucket.COST_MEDIUM, function (err, remainedTokens) {
					res.setHeader('X-RateLimit-Limit', tokenBucket.getLimitByCost(tokenBucket.COST_MEDIUM));
					res.setHeader('X-RateLimit-Remaining', tokenBucket.getRemainingTokenByCost(remainedTokens, tokenBucket.COST_MEDIUM));

					if (err) {
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
		} else {
			console.log('Rate limit mechanism disabled!');
		}

		server.options('/*', function (req, res) {
			const headers = {};
			// IE8 does not allow domains to be specified, just the *
			headers['Access-Control-Allow-Origin'] = req.headers.origin;
			// headers['Access-Control-Allow-Origin'] = '*';
			headers['Access-Control-Allow-Methods'] = 'POST, GET, PUT, DELETE, OPTIONS';
			headers['Access-Control-Allow-Credentials'] = true;
			headers['Access-Control-Max-Age'] = '3600'; //one hour
			headers['Access-Control-Allow-Headers'] = `Content-Type, Content-Length, X-Content-Length, Access-Control-Allow-Origin, User-Agent, ${conf.endpointsConfig.virtualMQ.signatureHeaderName}}`;
			res.writeHead(200, headers);
			res.end();
    });
    
    function addRootMiddlewares() {
      if(conf.enableRequestLogger) {
        new LoggerMiddleware(server);
      }
      if(conf.enableAuthorisation) {
        new AuthorisationMiddleware(server);
      }
      if(conf.iframeHandlerDsuBootPath) {
        new IframeHandlerMiddleware(server);
      }
    }

		function addMiddlewares() {
			const middlewareList = conf.activeEndpoints;
			const path = require("swarmutils").path;
			middlewareList.forEach(middleware => {
				const middlewareConfigName = Object.keys(conf.endpointsConfig).find(endpointName => endpointName === middleware);
				const middlewareConfig = conf.endpointsConfig[middlewareConfigName];
				let middlewarePath;
				if (middlewareConfigName) {
					middlewarePath = middlewareConfig.module;
					//console.log(middlewareConfig, middlewarePath);
					//console.log(conf.defaultEndpoints);
					if (middlewarePath.startsWith('.') && conf.defaultEndpoints.indexOf(middleware) === -1) {
						middlewarePath = path.resolve(path.join(process.env.PSK_ROOT_INSTALATION_FOLDER, middlewarePath));
					}
					console.log(`Preparing to register middleware from path ${middlewarePath}`);
					let middlewareImplementation;
					try{
						middlewareImplementation = require(middlewarePath);
					}catch(e){
						throw e;
					}
					if (typeof middlewareConfig.function !== 'undefined') {
						middlewareImplementation[middlewareConfig.function](server);
					} else {
						middlewareImplementation(server);
					}
				}
			})

		}

    addRootMiddlewares();
		addMiddlewares();
		setTimeout(function () {
			//allow other endpoints registration before registering fallback handler
			server.use(function (req, res) {
				res.statusCode = 404;
				res.end();
			});
			if (callback) {
				return callback();
			}
		}, 100);
	}
	return server;
}

module.exports.createInstance = function (port, folder, sslConfig, callback) {
	if (typeof sslConfig === 'function') {
		callback = sslConfig;
		sslConfig = undefined;
	}

	return new HttpServer({ listeningPort: port, rootFolder: folder, sslConfig }, callback);
};

module.exports.getVMQRequestFactory = function (virtualMQAddress, zeroMQAddress) {
	const VMQRequestFactory = require('./components/vmq/requestFactory');

	return new VMQRequestFactory(virtualMQAddress, zeroMQAddress);
};

module.exports.getHttpWrapper = function () {
	return require('./libs/http-wrapper');
};

module.exports.getServerConfig = function () {
	const config = require('./config');

	return config.getConfig();
};
