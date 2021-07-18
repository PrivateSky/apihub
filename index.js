const httpWrapper = require('./libs/http-wrapper');
const Server = httpWrapper.Server;
const TokenBucket = require('./libs/TokenBucket');
const START_TOKENS = 6000000;

const CHECK_FOR_RESTART_COMMAND_FILE_INTERVAL = 500;

const LoggerMiddleware = require('./middlewares/logger');
const AuthorisationMiddleware = require('./middlewares/authorisation');
const IframeHandlerMiddleware = require('./middlewares/iframeHandler');

function HttpServer({ listeningPort, rootFolder, sslConfig }, callback) {
	if (typeof $$.flows === "undefined") {
		require('callflow').initialise();
	}
	//next require lines are only for browserify build purpose
	// Remove mock
    require('./components/config');
    require('./components/contracts');
	require('./components/bricking');
	require('./components/anchoring');
	require('./components/channelManager');
	require('./components/bdns');
	require('./components/fileManager');
	require('./components/bricksFabric');
	require('./components/staticServer');
	require('./components/mqManager');
	require('./components/keySsiNotifications');
	require('./components/debugLogger');
	require('./components/mqHub');
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

	setInterval(function(){
		let restartServerFile = server.rootFolder + '/needServerRestart';
		const fsname = "fs";
		const fs = require(fsname);
		fs.readFile(restartServerFile, function(error, content) {
			if (!error && content.toString() !== "") {
				console.log(`### Preparing to restart because of the request done by file: <${restartServerFile}> File content: ${content}`);
				server.close();
				server.listen(port, conf.host, () => {
					fs.writeFile(restartServerFile, "", function(){
						//we don't care about this file.. we just clear it's content the prevent recursive restarts
						console.log("### Restart operation finished.");
					});
				});
			}
		});
	}, CHECK_FOR_RESTART_COMMAND_FILE_INTERVAL);

	server.on('listening', bindFinished);
	server.on('error', bindErrorHandler);

	function checkPortInUse(port, sslConfig, callback) {
		let commType = 'http';
		if (typeof sslConfig !== 'undefined') {
			commType += 's';
		}

		console.log(`Checking if port ${port} is available. Please wait...`);

		const req = require(commType).request({ port }, (res) => {
			res.on('data', (_) => {});
			res.on('end', () => {
				callback(undefined, true);
			})
		});
		req.on('error', (err) => {
			callback(undefined, false);
		});
		req.end();
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

	let endpointsAlreadyRegistered = false;
	function registerEndpoints(callback) {
		//The purpose of this flag is to prevent endpoints registering again
		//in case of a restart requested by file needServerRestart present in rootFolder
		if(endpointsAlreadyRegistered){
			return ;
		}
		endpointsAlreadyRegistered = true;
		server.use(function (req, res, next) {
			res.setHeader('Access-Control-Allow-Origin', req.headers.origin || req.headers.host);
			res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
			res.setHeader('Access-Control-Allow-Headers', `Content-Type, Content-Length, X-Content-Length, Access-Control-Allow-Origin, ${conf.componentsConfig.virtualMQ.signatureHeaderName}`);
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
			headers['Access-Control-Allow-Headers'] = `Content-Type, Content-Length, X-Content-Length, Access-Control-Allow-Origin, User-Agent, ${conf.componentsConfig.virtualMQ.signatureHeaderName}}`;
			res.writeHead(200, headers);
			res.end();
        });
    
        function addRootMiddlewares() {
            if(conf.enableRequestLogger) {
                new LoggerMiddleware(server);
            }
            if(conf.enableJWTAuthorisation) {
                new AuthorisationMiddleware(server);
            }
            if(conf.iframeHandlerDsuBootPath) {
                new IframeHandlerMiddleware(server);
            }
            if(conf.enableInstallationDetails) {
                const enableInstallationDetails = require("./components/installation-details");
                enableInstallationDetails(server);
            }
        }

        function addComponent(componentName, componentConfig) {
            const path = require("swarmutils").path;
            
            let componentPath = componentConfig.module;
            if (componentPath.startsWith('.') && conf.defaultComponents.indexOf(componentName) === -1) {
                componentPath = path.resolve(path.join(process.env.PSK_ROOT_INSTALATION_FOLDER, componentPath));
            }
            console.log(`Preparing to register middleware from path ${componentPath}`);

            let middlewareImplementation;
            try{
                middlewareImplementation = require(componentPath);
            } catch(e){
                throw e;
            }

            if (typeof componentConfig.function !== 'undefined') {
                middlewareImplementation[componentConfig.function](server);
            } else {
                middlewareImplementation(server);
            }
        }

		function addComponents() {
            const requiredComponentNames = ["config"];
            addComponent("config", {module: "./components/config"});

            // take only the components that have configurations and that are not part of the required components
			const middlewareList = [...conf.activeComponents]
                .filter(activeComponentName => {
                	let include = conf.componentsConfig[activeComponentName];
                	if(!include){
                		console.log(`[API-HUB] Not able to find config for component called < ${activeComponentName} >. Excluding it from the active components list!`);
					}
                	return include;
				})
                .filter(activeComponentName => !requiredComponentNames.includes(activeComponentName));

			middlewareList.forEach(componentName => {
                const componentConfig = conf.componentsConfig[componentName];
                addComponent(componentName, componentConfig);
            });
		}

        addRootMiddlewares();
		addComponents();
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

module.exports.getDomainConfig = function (domain, ...configKeys) {
	const config = require('./config');
	return config.getDomainConfig(domain, ...configKeys);
};

module.exports.anchoringStrategies = require("./components/anchoring/strategies");
