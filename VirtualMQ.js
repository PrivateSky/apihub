// require("./flows/CSBmanager");
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
	const server = new Server(sslConfig).listen(port);
	const tokenBucket = new TokenBucket(600000,1,10);
	const CSB_storage_folder = "uploads";
	const SWARM_storage_folder = "swarms";
	console.log("Listening on port:", port);

	this.close = server.close;
	$$.flow.start("BricksManager").init(path.join(rootFolder, CSB_storage_folder), function (err, result) {
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
            next();
        });

        server.post('/:channelId', function (req, res, next) {
            const contentType = req.headers['content-type'];

            if (contentType === 'application/octet-stream') {
                const contentLength = Number.parseInt(req.headers['content-length']);

                streamToBuffer(req, contentLength, (err, bodyAsBuffer) => {
                    if(err) {
                        res.statusCode = 500;
                        return;
                    }

                    req.body = msgpack.decode(bodyAsBuffer);

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
