function StaticServer(server) {
    const fs = require("fs");
    const path = require("path");
    const MimeType = require("./MimeType");

    function sendFiles(req, res, next) {
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
                    for (let prop in summary) {
                        if (Object.keys(summary[prop]).length === 0) {
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
                    let summaryId = currentPath.replace(targetPath, "");
                    summaryId = summaryId.split(path.sep).join("/");
                    if (summaryId === "") {
                        summaryId = "/";
                    }
                    //summaryId = path.basename(summaryId);
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
                                    let fileExtension = fileName.substring(fileName.lastIndexOf(".") + 1);
                                    let mimeType = MimeType.getMimeTypeFromExtension(fileExtension);
                                    if (mimeType.binary) {
                                        summary[summaryId][file] = Array.from(fileContent);
                                    } else {
                                        summary[summaryId][file] = fileContent.toString();
                                    }

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

    }

    function sendFile(res, file) {
        let stream = fs.createReadStream(file);
        const mimes = require("./MimeType");
        let ext = path.extname(file);
        if (ext !== "") {
            ext = ext.replace(".", "");
            res.setHeader('Content-Type', mimes.getMimeTypeFromExtension(ext).name);
        } else {
            res.setHeader('Content-Type', "application/octet-stream");
        }
        res.statusCode = 200;
        stream.pipe(res);
        stream.on('finish', () => {
            res.end();
        });
    }

    function requestValidation(req, method, urlPrefix, callback) {
        if (typeof urlPrefix === "function") {
            callback = urlPrefix;
            urlPrefix = undefined;
        }
        if (req.method !== method) {
            //we resolve only GET requests
            return callback(true);
        }

        if (typeof urlPrefix !== "undefined") {
            if (req.url.indexOf(urlPrefix) !== 0) {
                return callback(true);
            }
        }

        const rootFolder = server.rootFolder;
        const path = require("path");
        let requestedUrl = new URL(req.url, `http://${req.headers.host}`);
		let requestedUrlPathname = requestedUrl.pathname;
        if (urlPrefix) {
            requestedUrlPathname = requestedUrlPathname.replace(urlPrefix, "");
        }
        let targetPath = path.resolve(path.join(rootFolder, requestedUrlPathname));
        //if we detect tricks that tries to make us go above our rootFolder to don't resolve it!!!!
        if (targetPath.indexOf(rootFolder) !== 0) {
            return callback(true);
        }
        callback(false, targetPath);
    }

    function redirect(req, res, next) {
        requestValidation(req, "GET", function (notOurResponsibility, targetPath) {
            if (notOurResponsibility) {
                return next();
            }
            //from now on we mean to resolve the url
            //remove existing query params
            fs.stat(targetPath, function (err, stats) {
                if (err) {
                    res.statusCode = 404;
                    res.end();
                    return;
                }
                if (stats.isDirectory()) {

					let protocol = req.socket.encrypted ? "https" : "http";
					let url = new URL(req.url, `${protocol}://${req.headers.host}`);

                    if (url.pathname[url.pathname.length - 1] !== "/") {
                        res.writeHead(302, {
                            'Location': url.pathname + "/" +url.search
                        });
                        res.end();
                        return;
                    }
                    const defaultFileName = "index.html";
                    const defaultPath = path.join(targetPath, defaultFileName);
                    fs.stat(defaultPath, function (err) {
                        if (err) {
                            res.statusCode = 403;
                            res.end();
                            return;
                        }
                        return sendFile(res, defaultPath);
                    });
                } else {
                    return sendFile(res, targetPath);
                }
            });
        });
    }

    server.use("*", sendFiles);
    server.use("*", redirect);
}

module.exports = StaticServer;
