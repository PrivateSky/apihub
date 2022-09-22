const fs = require("fs");
const path = require("path");

function secrets(server) {
    const logger = $$.getLogger("secrets", "apihub/secrets");
    const secretsFolderPath = path.join(server.rootFolder, "external-volume", "secrets");
    server.get("/getSSOSecret/:appName", function (request, response) {
        let userId = request.headers["user-id"];
        let appName = request.params.appName;
        const fileDir = path.join(secretsFolderPath, appName);
        const filePath = path.join(fileDir, `${userId}.secret`);
        fs.access(filePath, (err) => {
            if (err) {
                response.statusCode = 204;
                response.end(JSON.stringify({error: `${userId} not found`}));
                return;
            }

            fs.readFile(filePath, (err, fileData) => {
                if (err) {
                    response.statusCode = 404;
                    response.end(JSON.stringify({error: `Couldn't find a secret for ${userId}`}));
                    return
                }

                response.statusCode = 200;
                response.end(JSON.stringify({secret: fileData.toString()}));
            })
        })
    });

    function ensureFolderExists(folderPath, callback) {
        fs.access(folderPath, (err)=>{
            if (err) {
                fs.mkdir(folderPath, {recursive: true}, callback);
                return;
            }

            callback();
        })
    }

    function writeSecret(filePath, secret, request, response) {
        fs.access(filePath, (err)=>{
            if (!err) {
                logger.error("File Already exists");
                response.statusCode = 403;
                response.end(Error(`File ${filePath} already exists`));
                return;
            }

            fs.writeFile(filePath, secret, (err)=>{
                if (err) {
                    logger.error("Error at writing file", err);
                    response.statusCode = 500;
                    response.end(err);
                    return;
                }

                response.statusCode = 200;
                response.end();
            });
        })
    }

    server.put('/putSSOSecret/:appName', function (request, response) {
        let userId = request.headers["user-id"];
        let appName = request.params.appName;
        let data = []

        request.on('error', (err) => {
            response.statusCode = 500;
            response.end(err);
        });

        request.on('data', (chunk) => {
            data.push(chunk);
        });

        request.on('end', async () => {
            const fileDir = path.join(secretsFolderPath, appName);
            const filePath = path.join(fileDir, `${userId}.secret`);
            let body;
            let msgToPersist;
            try {
                body = Buffer.concat(data).toString();
                msgToPersist = JSON.parse(body).secret;
            } catch (e) {
                logger.error("Failed to parse body", data);
                response.statusCode = 500;
                response.end(e);
            }

            ensureFolderExists(fileDir, (err)=>{
                if (err) {
                    response.statusCode = 500;
                    response.end(err);
                    return;
                }

                writeSecret(filePath, msgToPersist, request, response);
            })
        })
    });

    function getUserIdFromDID(did, appName) {
        const crypto = require("opendsu").loadAPI("crypto");
        const decodedDID = crypto.decodeBase58(did);
        const splitDecodedDID = decodedDID.split(":");
        let name = splitDecodedDID.slice(3).join(":");
        let userId = name.slice(appName.length + 1);
        return userId;
    }

    function deleteSSOSecret(request, response) {
        let did = request.params.did;
        let appName = request.params.appName;
        const fileDir = path.join(secretsFolderPath, appName);
        let userId = getUserIdFromDID(did, appName);
        const filePath = path.join(fileDir, `${userId}.secret`);
        fs.access(filePath, (err) => {
            if (err) {
                response.statusCode = 204;
                response.end(JSON.stringify({error: `${userId} not found`}));
                return;
            }

            fs.unlink(filePath, (err) => {
                if (err) {
                    response.statusCode = 404;
                    response.end(JSON.stringify({error: `Couldn't find a secret for ${userId}`}));
                    return
                }

                response.statusCode = 200;
                response.end();
            })
        })
    }

    server.delete("/deactivateSSOSecret/:appName/:did", deleteSSOSecret);
    server.delete("/removeSSOSecret/:appName/:did", deleteSSOSecret);
}

module.exports = secrets;
