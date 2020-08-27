function filesManager(server) {

	const uploadFile = require('./controllers/uploadFile');
	const downloadFile = require('./controllers/downloadFile');

	server.post('/files/upload/:folder', uploadFile);
	server.get('/files/download/:filepath', downloadFile);
}

module.exports = filesManager;