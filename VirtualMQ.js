require("./flows/CSBmanager");
require("./flows/remoteSwarming");
const path = require("path");
const httpWrapper = require('./libs/http-wrapper');
const edfs = require("edfs");
const EDFSMiddleware = edfs.EDFSMiddleware;
const Server = httpWrapper.Server;
const Router = httpWrapper.Router;
const TokenBucket = require('./libs/TokenBucket');
const msgpack = require('@msgpack/msgpack');


function VirtualMQ({listeningPort, rootFolder, sslConfig}, callback) {
	const port = listeningPort || 8080;

	let bindFinish = (err)=>{
		if(err){
			console.log(err);
			callback(err);
			return;
		}
		const tokenBucket = new TokenBucket(600000, 1, 10);
		const CSB_storage_folder = "uploads";
		const SWARM_storage_folder = "swarms";
		console.log("Listening on port:", port);

		this.close = server.close;
		$$.flow.start("CSBmanager").init(path.join(rootFolder, CSB_storage_folder), function (err, result) {
			if (err) {
				throw err;
			} else {
				console.log("CSBManager is using folder", result);
				$$.flow.start("RemoteSwarming").init(path.join(rootFolder, SWARM_storage_folder), function(err, result){
					registerEndpoints();
					if (callback) {
						callback();
					}
				});
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

        server.post('/:channelId', function (req, res, next) {
            const contentType = req.headers['content-type'];

            if (contentType === 'application/octet-stream') {
                const contentLength = Number.parseInt(req.headers['content-length']);

                streamToBuffer(req, contentLength, (err, bodyAsBuffer) => {
                    if(err) {
						res.statusCode = 500;
						res.end();
                        return;
                    }
					try{
						req.body = msgpack.decode(bodyAsBuffer);
					} catch (e) {
						res.statusCode = 500;
						res.end();
						return;
					}

                    next();
                });
            } else {
                next();
            }


            /***** HELPER FUNCTION *****/

            function streamToBuffer(stream, bufferSize, callback) {
                const buffer = Buffer.alloc(bufferSize);
                let currentOffset = 0;

                stream
                    .on('data', chunk => {
                        const chunkSize = chunk.length;
                        const nextOffset = chunkSize + currentOffset;

                        if (currentOffset > bufferSize - 1) {
                            stream.close();
                            return callback(new Error('Stream is bigger than reported size'));
                        }

                        unsafeAppendInBufferFromOffset(buffer, chunk, currentOffset);
                        currentOffset = nextOffset;

                    })
                    .on('end', () => {
                        callback(undefined, buffer);
                    })
                    .on('error', callback);


            }

            function unsafeAppendInBufferFromOffset(buffer, dataToAppend, offset) {
                const dataSize = dataToAppend.length;

                for (let i = 0; i < dataSize; i++) {
                    buffer[offset++] = dataToAppend[i];
                }
            }

        });

        server.post('/:channelId', function (req, res) {
            $$.flow.start("RemoteSwarming").startSwarm(req.params.channelId, JSON.stringify(req.body), function (err, result) {
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

                if ((req.query.waitConfirmation || 'false') === 'false') {
                    res.on('finish', () => {
                        $$.flow.start('RemoteSwarming').confirmSwarm(req.params.channelId, confirmationId, (err) => {
                        });
                    });
                } else {
                    responseMessage = {result, confirmationId};
                }

                res.setHeader('Content-Type', 'application/octet-stream');

                const encodedResponseMessage = msgpack.encode(responseMessage);
                res.write(Buffer.from(encodedResponseMessage));
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

		//folder can be userId/tripId/...
		server.post('/files/upload/:folder', function (req,res) {
			let fileManager = require('./fileManager');
			fileManager.upload(req, (err, result)=>{
				if(err){
					res.statusCode = 500;
					res.end();
				}else{
					res.statusCode = 200;
					res.end(JSON.stringify(result));
				}
			})
		});

		server.get('/files/download/:folder/:fileId', function (req,res) {
			let fileManager = require('./fileManager');
			fileManager.download(req, (err, result)=>{
				if(err){
					res.statusCode = 404;
					res.end();
				}else{
					res.statusCode = 200;
					res.setHeader('Content-Type', `image/${req.params.fileId.split('.')[1]}`);
					result.pipe(res);
					result.on('finish', () => {
						res.end();
					})
				}
			})
		});

		server.post('/CSB', function (req, res) {
			//preventing illegal characters passing as fileId
			res.statusCode = 400;
			res.end();
		});

		server.post('/CSB/compareVersions', function(req, res) {
			$$.flow.start('CSBmanager').compareVersions(req, function(err, filesWithChanges) {
				if (err) {
					console.log(err);
					res.statusCode = 500;
				}
				res.end(JSON.stringify(filesWithChanges));
			});
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
			res.setHeader("content-type", "application/octet-stream");
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
			$$.flow.start("CSBmanager").getVersionsForFile(req.params.fileId, function(err, fileVersions) {
				if(err) {
					console.error(err);
					res.statusCode = 404;
				}

				res.end(JSON.stringify(fileVersions));
			});
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

		server.options('/*', function (req, res) {
			var headers = {};
			// IE8 does not allow domains to be specified, just the *
			// headers["Access-Control-Allow-Origin"] = req.headers.origin;
			headers["Access-Control-Allow-Origin"] = "*";
			headers["Access-Control-Allow-Methods"] = "POST, GET, PUT, DELETE, OPTIONS";
			headers["Access-Control-Allow-Credentials"] = true;
			headers["Access-Control-Max-Age"] = '3600'; //one hour
			headers["Access-Control-Allow-Headers"] = "Content-Type, Access-Control-Allow-Origin, User-Agent";
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

module.exports.getHttpWrapper = function() {
	return require('./libs/http-wrapper');
};
