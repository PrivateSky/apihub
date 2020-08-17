function filesManager(server) {

	const controllers=  require('./controllers');
	
	server.post('/files/upload/:folder', controllers.uploadFile);
	server.get('/files/download/:filepath', controllers.downloadFile);
}

module.exports = filesManager;