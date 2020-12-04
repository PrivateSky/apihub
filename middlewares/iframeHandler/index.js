const http = require("http");
const crypto = require("crypto");
const worker_threads = "worker_threads";
const { Worker } = require(worker_threads);
const config = require("../../config").getConfig();
const path = require("swarmutils").path;

function IframeHandler(server) {
    console.log(`Registering IframeHandler middleware`);

    let { iframeHandlerDsuBootPath } = config;

    if (iframeHandlerDsuBootPath.startsWith(".")) {
        iframeHandlerDsuBootPath = path.resolve(
            path.join(process.env.PSK_ROOT_INSTALATION_FOLDER, iframeHandlerDsuBootPath)
        );
    }

    console.log(`Using boot script for worker: ${iframeHandlerDsuBootPath}`);

    const dsuWorkers = {};

    const addDsuWorker = (seed) => {
        const dsuWorker = {
            port: null,
            authorizationKey: null,
            resolver: new Promise((resolve, reject) => {
                crypto.randomBytes(64, (err, randomBuffer) => {
                    if (err) {
                        console.log("Error while generating worker authorizationKey", err);
                        return reject(err);
                    }

                    const authorizationKey = randomBuffer.toString("hex");
                    dsuWorker.authorizationKey = authorizationKey;

                    const worker = new Worker(iframeHandlerDsuBootPath, {
                        workerData: {
                            seed,
                            authorizationKey,
                        },
                    });

                    worker.on("message", (message) => {
                        if (message.port) {
                            console.log(`Running worker on PORT ${message.port} for seed ${seed}`);
                            dsuWorker.port = message.port;
                            resolve(worker);
                        }
                    });
                    worker.on("error", (error) => {
                        console.log("worker error", error);
                    });
                    worker.on("exit", (code) => {
                        if (code !== 0) {
                            console.log(`Worker stopped with exit code ${code}`);
                            // remove the worker from list in order to be recreated when needed
                            dsuWorkers[seed] = null;
                        }
                    });
                });
            }),
        };
        dsuWorkers[seed] = dsuWorker;
        return dsuWorker;
    };

    server.use(function (req, res, next) {
        const { method, url } = req;

        if (url.indexOf("iframe") === -1) {
            // not an iframe related request so skip it
            next();
            return;
        }

        let keySSI = url.substr(url.indexOf("iframe") + "iframe".length + 1);
        let requestedPath = "";
        if (!keySSI || keySSI === "null") {
            res.statusCode = 500;
            return res.end("empty keySSI");
        }

        const urlPathInfoMatch = keySSI.match(/^([^\/\?]*)[\/\?](.*)$/);
        if (urlPathInfoMatch) {
            keySSI = urlPathInfoMatch[1];
            requestedPath = urlPathInfoMatch[2];
        }

        let dsuWorker = dsuWorkers[keySSI];
        if (!dsuWorker) {
            dsuWorker = addDsuWorker(keySSI);
        }

        dsuWorker.resolver.then(() => {
            const options = {
                hostname: "localhost",
                port: dsuWorker.port,
                path: `/${requestedPath}`,
                method,
                headers: {
                    authorization: dsuWorker.authorizationKey,
                },
            };

            const req = http.request(options, (response) => {
                const { statusCode, headers } = response;
                res.statusCode = statusCode;
                if (headers) {
                    res.setHeader("Content-Type", response.headers["content-type"] || "text/html");
                }

                if (statusCode < 200 || statusCode >= 300) {
                    console.log(`Worker failed to execute path ${requestedPath} with status code ${statusCode}`);
                    return res.end();
                }

                let data = [];
                response.on("data", (chunk) => {
                    data.push(chunk);
                });

                response.on("end", () => {
                    try {
                        const bodyContent = Buffer.concat(data);
                        res.end(bodyContent);
                    } catch (err) {
                        console.log("worker response error", err);
                        res.statusCode = 500;
                        res.end();
                    }
                });
            });
            req.on("error", (err) => {
                console.log("worker request error", err);
                res.statusCode = 500;
                res.end();
            });

            // req.write(body);
            req.end();
        });
    });
}

module.exports = IframeHandler;
