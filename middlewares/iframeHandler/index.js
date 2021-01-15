const http = require("http");
const crypto = require("crypto");
const worker_threads = "worker_threads";
const { Worker } = require(worker_threads);
const config = require("../../config").getConfig();
const path = require("swarmutils").path;

const getElapsedTime = (timer) => {
    const elapsed = process.hrtime(timer)[1] / 1000000;
    return `${elapsed.toFixed(3)} ms`;
};

const INVALID_DSU_HTML_RESPONSE = `
    <html>
    <body>
        <p>
            The application has encountered an unexpected error. <br/>
            If you have network issues please use the following to refresh the application.
        </p>
        <button id="refresh">Refresh</button>
        <script>
            document.getElementById("refresh").addEventListener("click", function() {
                window.top.location.reload();
            });
        </script>
    </body>
    </html>
`;

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
        const workerStartTime = process.hrtime();
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

                    console.log(`Starting worker for handling seed ${seed}`);
                    const worker = new Worker(iframeHandlerDsuBootPath, {
                        workerData: {
                            seed,
                            authorizationKey,
                        },
                    });

                    worker.on("message", (message) => {
                        if (message.error) {
                            dsuWorkers[seed] = null;
                            return reject(message.error);
                        }
                        if (message.port) {
                            console.log(
                                `Running worker on PORT ${message.port} for seed ${seed}. Startup took ${getElapsedTime(
                                    workerStartTime
                                )}`
                            );
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

    //if a listening event is fired from this point on...
    //it means that a restart was triggered
    server.on("listening", ()=>{
        if(typeof dsuWorkers !== "undefined"){
            console.log(`Restarting process in progress...`);
            console.log(`Stopping a number of ${Object.keys(dsuWorkers).length} thread workers`);
            for(let seed in dsuWorkers){
                let worker = dsuWorkers[seed];
                if(typeof worker !== "undefined"){
                    worker.terminate();
                    delete dsuWorkers[seed];
                }
            }
        }
    });

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
            const keySSIPart = urlPathInfoMatch[1];
            const separator = keySSI[keySSIPart.length];
            keySSI = keySSIPart;
            requestedPath = `${separator !== "/" ? "/" : ""}${separator}${urlPathInfoMatch[2]}`;
        }

        let dsuWorker = dsuWorkers[keySSI];
        if (!dsuWorker) {
            dsuWorker = addDsuWorker(keySSI);
        }

        const requestStartTime = process.hrtime();

        const forwarRequestToWorker = () => {
            const options = {
                hostname: "localhost",
                port: dsuWorker.port,
                path: requestedPath,
                method,
                headers: {
                    authorization: dsuWorker.authorizationKey,
                },
            };

            if (req.headers["content-type"]) {
                options.headers["content-type"] = req.headers["content-type"];
            }

            const logRequestInfo = (statusCode) => {
                const duration = getElapsedTime(requestStartTime);
                const message = `[STATUS ${statusCode}][${duration}][${method}] ${requestedPath}`;
                console.log(message);
            };

            const workerRequest = http.request(options, (response) => {
                const { statusCode, headers } = response;
                res.statusCode = statusCode;
                const contentType = headers ? headers["content-type"] : null;
                res.setHeader("Content-Type", contentType || "text/html");

                if (statusCode < 200 || statusCode >= 300) {
                    logRequestInfo(statusCode);
                    return res.end();
                }

                let data = [];
                response.on("data", (chunk) => {
                    data.push(chunk);
                });

                response.on("end", () => {
                    try {
                        const bodyContent = $$.Buffer.concat(data);
                        logRequestInfo(statusCode);
                        res.statusCode = statusCode;
                        res.end(bodyContent);
                    } catch (err) {
                        logRequestInfo(500);
                        console.log("worker response error", err);
                        res.statusCode = 500;
                        res.end();
                    }
                });
            });
            workerRequest.on("error", (err) => {
                logRequestInfo(500);
                console.log("worker request error", err);
                res.statusCode = 500;
                res.end();
            });

            if (method === "POST" || method === "PUT") {
                let data = [];
                req.on("data", (chunk) => {
                    console.log("data.push(chunk);", chunk);
                    data.push(chunk);
                });

                req.on("end", () => {
                    try {
                        const bodyContent = $$.Buffer.concat(data);
                        workerRequest.write(bodyContent);
                        workerRequest.end();
                    } catch (err) {
                        logRequestInfo(500);
                        console.log("worker response error", err);
                        res.statusCode = 500;
                        res.end();
                    }
                });
                return;
            }
            workerRequest.end();
        };

        dsuWorker.resolver.then(forwarRequestToWorker).catch((error) => {
            console.log("worker resolver error", error);
            res.setHeader("Content-Type", "text/html");
            res.statusCode = 400;
            res.end(INVALID_DSU_HTML_RESPONSE);
        });
    });
}

module.exports = IframeHandler;
