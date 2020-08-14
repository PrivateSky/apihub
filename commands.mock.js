function commandsMock(server) {
	function run(request, response, next) {

		response.statusCode = 500;
		response.end(JSON.stringify({ status: 'ok' , command: 'test url'}));
		return;
	}

	server.get('/test', run);
}

module.exports = commandsMock;
