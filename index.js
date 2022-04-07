const {LOG_IDENTIFIER} = require("./moduleConstants");

const httpWrapper = require('./libs/http-wrapper');
const Server = httpWrapper.Server;

const TokenBucket = require('./libs/TokenBucket');
const START_TOKENS = 6000000;
const CHECK_FOR_RESTART_COMMAND_FILE_INTERVAL = 500;

(function loadDefaultComponents(){
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
	require('./components/enclave');
	require('./components/secrets');
	//end
})();

function HttpServer({ listeningPort, rootFolder, sslConfig, dynamicPort, restartIntervalCheck, retryTimeout }, callback) {
	if (typeof $$.flows === "undefined") {
		require('callflow').initialise();
	}

	if(typeof restartIntervalCheck === "undefined"){
		restartIntervalCheck = CHECK_FOR_RESTART_COMMAND_FILE_INTERVAL;
	}

	let port = listeningPort || 8080;
	const tokenBucket = new TokenBucket(START_TOKENS, 1, 10);

	const conf =  require('./config').getConfig();
	const server = new Server(sslConfig);
	server.config = conf;
	server.rootFolder = rootFolder;

	let listenCallback = (err) => {
		if (err) {
			console.log(LOG_IDENTIFIER, err);
			if (!dynamicPort && callback) {
				return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed to listen on port <${port}>`, err));
			}
			if(dynamicPort && error.code === 'EADDRINUSE'){
				function getRandomPort() {
					const min = 9000;
					const max = 65535;
					return Math.floor(Math.random() * (max - min) + min);
				}
				port = getRandomPort();
				if(Number.isInteger(dynamicPort)){
					dynamicPort -= 1;
				}
				let timeValue = retryTimeout || CHECK_FOR_RESTART_COMMAND_FILE_INTERVAL;
				console.log(LOG_IDENTIFIER, `setting a timeout value of before retrying ${timeValue}`);
				setTimeout(bootup, );
			}
		}
	};

	function bootup(){
		console.log(LOG_IDENTIFIER, `Trying to listen on port ${port}`);
		server.listen(port, conf.host, listenCallback);
	};

	bootup();

	if(restartIntervalCheck){
		setInterval(function(){
			let restartServerFile = server.rootFolder + '/needServerRestart';
			const fsname = "fs";
			const fs = require(fsname);
			fs.readFile(restartServerFile, function(error, content) {
				if (!error && content.toString() !== "") {
					console.log(`${LOG_IDENTIFIER} ### Preparing to restart because of the request done by file: <${restartServerFile}> File content: ${content}`);
					server.close();
					server.listen(port, conf.host, () => {
						fs.writeFile(restartServerFile, "", function(){
							//we don't care about this file.. we just clear it's content the prevent recursive restarts
							console.log(`${LOG_IDENTIFIER} ### Restart operation finished.`);
						});
					});
				}
			});
		}, restartIntervalCheck);
	}

	server.on('listening', bindFinished);
	server.on('error', listenCallback);

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
			res.setHeader('Access-Control-Allow-Headers', `Content-Type, Content-Length, X-Content-Length, Access-Control-Allow-Origin, ${conf.componentsConfig.virtualMQ.signatureHeaderName}, token`);
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
			console.log(`${LOG_IDENTIFIER} Rate limit mechanism disabled!`);
		}

		server.options('/*', function (req, res) {
			const headers = {};
			// IE8 does not allow domains to be specified, just the *
			headers['Access-Control-Allow-Origin'] = req.headers.origin;
			// headers['Access-Control-Allow-Origin'] = '*';
			headers['Access-Control-Allow-Methods'] = 'POST, GET, PUT, DELETE, OPTIONS';
			headers['Access-Control-Allow-Credentials'] = true;
			headers['Access-Control-Max-Age'] = '3600'; //one hour
			headers['Access-Control-Allow-Headers'] = `Content-Type, Content-Length, X-Content-Length, Access-Control-Allow-Origin, User-Agent, Authorization, ${conf.componentsConfig.virtualMQ.signatureHeaderName}, token`;
			
			if(conf.CORS){
				console.log("Applying custom CORS headers");
				for(let prop in conf.CORS){
					headers[prop] = conf.CORS[prop];
				}
			}
			
			res.writeHead(200, headers);
			res.end();
        });

        function addRootMiddlewares() {
			const LoggerMiddleware = require('./middlewares/logger');
			const AuthorisationMiddleware = require('./middlewares/authorisation');
			const OAuth = require('./middlewares/oauth');
			const IframeHandlerMiddleware = require('./middlewares/iframeHandler');
			const ResponseHeaderMiddleware = require('./middlewares/responseHeader');
			const genericErrorMiddleware = require('./middlewares/genericErrorMiddleware');
			const requestEnhancements = require('./middlewares/requestEnhancements');

			if(conf.enableRequestLogger) {
				new LoggerMiddleware(server);
			}

			genericErrorMiddleware(server);
			requestEnhancements(server);

            if(conf.enableJWTAuthorisation) {
                new AuthorisationMiddleware(server);
            }
			if(conf.enableOAuth) {
                new OAuth(server);
            }
			if(conf.responseHeaders){
				new ResponseHeaderMiddleware(server);
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
            console.log(`${LOG_IDENTIFIER} Preparing to register middleware from path ${componentPath}`);

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
                		console.log(`${LOG_IDENTIFIER} Not able to find config for component called < ${activeComponentName} >. Excluding it from the active components list!`);
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

module.exports.start = function(options, callback){
	return new HttpServer(options, callback);
}

module.exports.getVMQRequestFactory = function (virtualMQAddress, zeroMQAddress) {
	const VMQRequestFactory = require('./components/vmq/requestFactory');

	return new VMQRequestFactory(virtualMQAddress, zeroMQAddress);
};

module.exports.getHttpWrapper = function () {
	return require('./libs/http-wrapper');
};

module.exports.getServerConfig = function () {
	console.log(`${LOG_IDENTIFIER} apihub.getServerConfig() method is deprecated, please use server.config to retrieve necessary info.`);
	const config = require('./config');
	return config.getConfig();
};

module.exports.getDomainConfig = function (domain, ...configKeys) {
	console.log(`${LOG_IDENTIFIER} apihub.getServerConfig() method is deprecated, please use server.config.getDomainConfig(...) to retrieve necessary info.`);
	const config = require('./config');
	return config.getDomainConfig(domain, ...configKeys);
};

module.exports.anchoringStrategies = require("./components/anchoring/strategies");
