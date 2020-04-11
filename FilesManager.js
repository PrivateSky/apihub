const fs = require('fs');
const path = require('path');
let rootFolder = process.env.npm_package_config_ROOT_FILE_UPLOAD || process.env.ROOT_FILE_UPLOAD || "./FileUploads";

rootFolder = path.resolve(rootFolder);

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
	const completeFolderPath = path.join(rootFolder, folder);

	const contentType = req.headers['content-type'].split('/');

	if (contentType[0] === 'image' || (contentType[0] === 'application' && contentType[1] === 'pdf')) {
		filename += '.' + contentType[1];
	} else {
		return callback('err');
	}
	try {
		fs.mkdirSync(completeFolderPath, {recursive: true});
	} catch (e) {
		return callback(e);
	}
	const writeStream = fs.createWriteStream(path.join(completeFolderPath, filename));

	writeStream.on('finish', () => {
		writeStream.close();
		return callback(null, {'path': path.posix.join(folder, filename)});
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

	const completeFolderPath = path.join(rootFolder, folder);
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

function FilesManager(server) {
	//folder can be userId/tripId/...
	server.post('/files/upload/:folder', function (req, res) {
		upload(req, (err, result) => {
			if (err) {
				res.statusCode = 500;
				res.end();
			} else {
				res.statusCode = 200;
				res.end(JSON.stringify(result));
			}
		})
	});

	server.get('/files/download/:filepath', function (req, res) {
		download(req, res, (err, result) => {
			if (err) {
				res.statusCode = 404;
				res.end();
			} else {
				sendResult(res, result);
			}
		});
	});

	const lockedPathsPrefixes = ["/EDFS", "/receive-message"];
	if (typeof process.env.PSK_VIRTUAL_MQ_STATIC !== "undefined" && process.env.PSK_VIRTUAL_MQ_STATIC === "true") {
		server.use("*", function (req, res, next) {
			const prefix = "/directory-summary/";
			requestValidation(req, "GET", prefix, function (notOurResponsibility, targetPath) {
				if (notOurResponsibility) {
					return next();
				}
				targetPath = targetPath.replace(prefix, "");
				serverTarget(targetPath);
			});

			function serverTarget(targetPath) {
				console.log("Serving summary for dir:", targetPath);
				fs.stat(targetPath, function (err, stats) {
					if (err) {
						res.statusCode = 404;
						res.end();
						return;
					}
					if (!stats.isDirectory()) {
						res.statusCode = 403;
						res.end();
						return;
					}

					function send() {
						res.statusCode = 200;
						res.setHeader('Content-Type', "application/json");
						//let's clean some empty objects
						for(let prop in summary){
							if(Object.keys(summary[prop]).length===0){
								delete summary[prop];
							}
						}

						res.write(JSON.stringify(summary));
						res.end();
					}

					let summary = {};
					let directories = {};

					function extractContent(currentPath) {
						directories[currentPath] = -1;
						let summaryId = currentPath.replace(server.rootFolder, "");
						summaryId = summaryId.split(path.sep).join("/");
						summaryId = path.basename(summaryId);
						summary[summaryId] = {};

						fs.readdir(currentPath, function (err, files) {
							if (err) {
								return markAsFinish(currentPath);
							}
							directories[currentPath] = files.length;
							//directory empty test
							if (files.length === 0) {
								return markAsFinish(currentPath);
							} else {
								for (let i = 0; i < files.length; i++) {
									let file = files[i];
									const fileName = path.join(currentPath, file);
									if (fs.statSync(fileName).isDirectory()) {
										extractContent(fileName);
									} else {
										let fileContent = fs.readFileSync(fileName);
										summary[summaryId][file] = fileContent.toString();
									}
									directories[currentPath]--;
								}
								return markAsFinish(currentPath);
							}
						});
					}

					function markAsFinish(targetPath) {
						if (directories [targetPath] > 0) {
							return;
						}
						delete directories [targetPath];
						const dirsLeftToProcess = Object.keys(directories);
						//if there are no other directories left to process
						if (dirsLeftToProcess.length === 0) {
							send();
						}
					}

					extractContent(targetPath);
				})
			}

		});

		server.use("*", function (req, res, next) {
			requestValidation(req, "GET", function (notOurResponsibility, targetPath) {
				if (notOurResponsibility) {
					return next();
				}
				//from now on we mean to resolve the url
				fs.stat(targetPath, function (err, stats) {
					if (err) {
						res.statusCode = 404;
						res.end();
						return;
					}
					if (stats.isDirectory()) {
						//we don't support yet directory serving or default files like index.html
						res.statusCode = 403;
						res.end();
					} else {
						let stream = fs.createReadStream(targetPath);
						const mimes = require("./MimeType");
						let ext = path.extname(targetPath);
						if (ext !== "") {
							ext = ext.replace(".", "");
							res.setHeader('Content-Type', mimes.getMimeTypeFromExtension(ext).name);
						} else {
							res.setHeader('Content-Type', "application/octet-stream");
						}
						return sendResult(res, stream);
					}
				});
			});
		});

		function requestValidation(req, method, urlPrefix, callback) {
			if (typeof urlPrefix === "function") {
				callback = urlPrefix;
				urlPrefix = undefined;
			}
			if (req.method !== method) {
				//we resolve only GET requests
				return callback(true);
			}

			if (typeof urlPrefix === "undefined") {
				for (let i = 0; i < lockedPathsPrefixes.length; i++) {
					let reservedPath = lockedPathsPrefixes[i];
					//if we find a url that starts with a reserved prefix is not our duty ro resolve
					if (req.url.indexOf(reservedPath) === 0) {
						return callback(true);
					}
				}
			} else {
				if (req.url.indexOf(urlPrefix) !== 0) {
					return callback(true);
				}
			}

			const rootFolder = server.rootFolder;
			const path = require("path");
			let requestedUrl = req.url;
			if (urlPrefix) {
				requestedUrl = requestedUrl.replace(urlPrefix, "");
			}
			let targetPath = path.resolve(path.join(rootFolder, requestedUrl));
			//if we detect tricks that tries to make us go above our rootFolder to don't resolve it!!!!
			if (targetPath.indexOf(rootFolder) !== 0) {
				return callback(true);
			}
			callback(false, targetPath);
		}
	}
}

module.exports = FilesManager;