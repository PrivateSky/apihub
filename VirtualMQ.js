require("./flows/CSBmanager");
const Server = require('./libs/http-wrapper/src/index').Server;

function VirtualMQ(listeningPort, rootFolder) {
	const port = listeningPort || 8080;
	const server = new Server().listen(port);
	console.log("Listening on port:", port);

	$$.flow.create("CSBmanager").init(rootFolder, function(err, result){
		if(err){
			throw err;
		}else{
			console.log("CSBmanager is using folder", result);
		}
	});

	server.post('/CSB/:fileId', function (req, res) {
		if (req.headers['content-type'] !== 'application/octet-stream') {

			$$.flow.create("CSBmanager").write(req.params.fileId, req, function(err, result){
				if(err){
					console.log(err);
					res.statusCode = 500;
					res.end();
				}else{
					res.statusCode = 201;
					res.end();
				}
			});
		}
	});

	server.get('/CSB/:fileId', function (req, res) {
		$$.flow.create("CSBmanager").read(req.params.fileId, res, function(err, result){
			if(err){
				console.log(err);
				res.statusCode = 404;
				res.end();
			}else{
				res.statusCode = 201;
				res.end();
			}
		});
	});

	server.use(function (req, res) {
		res.statusCode = 404;
		res.end();
	});
}

module.exports.createVirtualMQ = function(port, folder){
	return new VirtualMQ(port, folder);
}