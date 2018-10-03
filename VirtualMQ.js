require("./flows/CSBmanager");
require("./flows/remoteSwarming");
const path = require("path");
const Server = require('./libs/http-wrapper/src/index').Server;
const TokenBucket = require('./libs/TokenBucket');


function VirtualMQ(listeningPort, rootFolder, callback) {
	const port = listeningPort || 8080;
	const server = new Server().listen(port);
    const tokenBucket = new TokenBucket();
	const CSB_storage_folder = "uploads";
	const SWARM_storage_folder = "swarms";
	console.log("Listening on port:", port);

	this.close = server.close;
	$$.flow.start("CSBmanager").init(path.join(rootFolder, CSB_storage_folder), function (err, result) {
		if (err) {
			throw err;
		} else {
			console.log("CSBmanager is using folder", result);
			$$.flow.start("RemoteSwarming").init(path.join(rootFolder, SWARM_storage_folder), function(err, result){
				registerEndpoints();
				if (callback) {
					callback();
				}
			});
		}
	});



	function registerEndpoints() {

		server.use(function (req, res, next) {
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
			res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Allow-Origin');
			res.setHeader('Access-Control-Allow-Credentials', true);
			next();
		});

		server.use(function (req, res, next) {
            const ip = res.socket.remoteAddress;

			tokenBucket.takeToken(ip, tokenBucket.COST_MEDIUM, function(err, remainedTokens) {
                res.setHeader('X-RateLimit-Limit', tokenBucket.getLimitByCost(tokenBucket.COST_MEDIUM));
				res.setHeader('X-RateLimit-Remaining', tokenBucket.getRemainingTokenByCost(remainedTokens, tokenBucket.COST_MEDIUM));

				if(err) {
					switch (err) {
						case TokenBucket.ERROR_LIMIT_EXCEEDED:
							res.statusCode = 429;
							break;
						default:
							res.statusCode = 500;

                    }

                    res.end();
					return;
				}

				next();
			});
		});

        server.post('/CSB', function (req, res) {
        	//preventing illegal characters passing as fileId
            res.statusCode = 400;
            res.end();
        });

        server.post('/CSB/:fileId', function (req, res) {
            $$.flow.start("CSBmanager").write(req.params.fileId, req, function (err, result) {
                res.statusCode = 201;
                if (err) {
                    res.statusCode = 500;

                    if (err.code === 'EACCES') {
                        res.statusCode = 409;
                    }
                }
                res.end();
            });

        });

        server.get('/CSB/:fileId', function (req, res) {

            $$.flow.start("CSBmanager").read(req.params.fileId, res, function (err, result) {
                res.statusCode = 200;
                if (err) {
                    console.log(err);
                    res.statusCode = 404;
                }
                res.end();
            });
        });

        server.get('/CSB/:fileId/versions', function (req, res) {
			$$.flow.start("CSBmanager").getVersionsForFile(req.params.fileId, res, function(err, fileVersions) {
				if(err) {
					console.error(err);
					res.statusCode = 404;
				}

				res.end(fileVersions.toString());
			})
		});

        server.get('/CSB/:fileId/:version', function (req, res) {
            $$.flow.start("CSBmanager").readVersion(req.params.fileId, req.params.version, res, function (err, result) {
                res.statusCode = 200;
                if (err) {
                    console.log(err);
                    res.statusCode = 404;
                }
                res.end();
            });
        });

		server.post('/:channelId', function (req, res) {

			$$.flow.start("RemoteSwarming").startSwarm(req.params.channelId, req, function (err, result) {
				res.statusCode = 201;
				if (err) {
					console.log(err);
					res.statusCode = 500;
				}
				res.end();
			});
		});

		server.get('/:channelId', function (req, res) {
			$$.flow.start("RemoteSwarming").waitForSwarm(req.params.channelId, res, function (err, result, confirmationId) {
				if (err) {
					console.log(err);
					res.statusCode = 500;
				}

				let responseMessage = result;

				if((req.query.waitConfirmation || 'false')  === 'false') {
					res.on('finish', () => {
						$$.flow.start('RemoteSwarming').confirmSwarm(req.params.channelId, confirmationId, (err) => {});
					});
				} else {
					responseMessage = {result, confirmationId};
				}

				res.write(JSON.stringify(responseMessage));
				res.end();
			});



		});

		server.delete("/:channelId/:confirmationId", function(req, res){
			$$.flow.start("RemoteSwarming").confirmSwarm(req.params.channelId, req.params.confirmationId, function (err, result) {
				if (err) {
					console.log(err);
					res.statusCode = 500;
				}
				res.end();
			});
		});



		server.options('/!*', function (req, res) {
			var headers = {};
			// IE8 does not allow domains to be specified, just the *
			// headers["Access-Control-Allow-Origin"] = req.headers.origin;
			headers["Access-Control-Allow-Origin"] = "*";
			headers["Access-Control-Allow-Methods"] = "POST, GET, PUT, DELETE, OPTIONS";
			headers["Access-Control-Allow-Credentials"] = true;
			headers["Access-Control-Max-Age"] = '3600'; //one hour
			headers["Access-Control-Allow-Headers"] = "Content-Type, Access-Control-Allow-Origin";
			res.writeHead(200, headers);
			res.end();
		});

		server.use(function (req, res) {
			res.statusCode = 404;
			res.end();
		});
	}
}

module.exports.createVirtualMQ = function(port, folder, callback){
	return new VirtualMQ(port, folder, callback);
};
