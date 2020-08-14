function FilesManager(server) {
	const fs = require('fs');
	const path = require('path');
	const { serverConfig: serverConfigUtils } = require('./utils');

	//folder can be userId/tripId/...

	function uploadFile(req, res) {
		upload(req, (err, result) => {
			if (err) {
				res.statusCode = 500;
				res.end();
			} else {
				res.statusCode = 200;
				res.end(JSON.stringify(result));
			}
		})
	}

	function downloadFile(req, res) {
		download(req, res, (err, result) => {
			if (err) {
				res.statusCode = 404;
				res.end();
			} else {
				sendResult(res, result);
			}
		});
	}

	guid = function () {
		function s4() {
			return Math.floor((1 + Math.random()) * 0x10000)
				.toString(16)
				.substring(1);
		}

		return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
	};

	function upload(req, callback) {
		const readFileStream = req;
		if (!readFileStream || !readFileStream.pipe || typeof readFileStream.pipe !== "function") {
			callback(new Error("Something wrong happened"));
			return;
		}

		const folder = Buffer.from(req.params.folder, 'base64').toString().replace('\n', '');
		
		if (folder.includes('..')) {
			return callback('err');
		}

		let filename = guid();

		if (filename.split('.').length > 1) {
			return callback('err');
		}

		const completeFolderPath = path.join(serverConfigUtils.getConfig('storage'), folder);

		const contentType = req.headers['content-type'].split('/');

		if (contentType[0] === 'image' || (contentType[0] === 'application' && contentType[1] === 'pdf')) {
			filename += '.' + contentType[1];
		} else {
			return callback('err');
		}

		try {
			fs.mkdirSync(completeFolderPath, { recursive: true });
		} catch (e) {
			return callback(e);
		}

		const writeStream = fs.createWriteStream(path.join(completeFolderPath, filename));

		writeStream.on('finish', () => {
			writeStream.close();
			return callback(null, { 'path': path.posix.join(folder, filename) });
		});

		writeStream.on('error', (err) => {
			writeStream.close();
			return callback(err);
		});
		req.pipe(writeStream);
	}

	function download(req, res, callback) {
		const readFileStream = req;
		if (!readFileStream || !readFileStream.pipe || typeof readFileStream.pipe !== "function") {
			callback(new Error("Something wrong happened"));
			return;
		}
		
		const folder = Buffer.from(req.params.filepath, 'base64').toString().replace('\n', '');
		const completeFolderPath = path.join(serverConfigUtils.getConfig('storage'), folder);
		
		if (folder.includes('..')) {
			return callback(new Error("invalidPath"));
		}

		if (fs.existsSync(completeFolderPath)) {
			const fileToSend = fs.createReadStream(completeFolderPath);
			res.setHeader('Content-Type', `image/${folder.split('.')[1]}`);
			return callback(null, fileToSend);
		} else {
			return callback(new Error("PathNotFound"));
		}
	}

	function sendResult(resHandler, resultStream) {
		resHandler.statusCode = 200;
		resultStream.pipe(resHandler);
		resultStream.on('finish', () => {
			resHandler.end();
		});
	}


	server.post('/files/upload/:folder', uploadFile);
	server.get('/files/download/:filepath', downloadFile);
}

module.exports = FilesManager;