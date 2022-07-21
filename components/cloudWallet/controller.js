const http = require("http");
const crypto = require("crypto");
const worker_threads = "worker_threads";
const { Worker } = require(worker_threads);
const config = require("../../config");
const path = require("swarmutils").path;

let dsuBootPath;
const dsuWorkers = {};

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

function addDsuWorker(seed, cookie) {
    const workerStartTime = process.hrtime();
    const dsuWorker = {
        port: null,
        authorizationKey: null,
        resolver: new Promise((resolve, reject) => {
            crypto.randomBytes(64, (err, randomBuffer) => {
                if (err) {
                    console.log("[CloudWallet] Error while generating worker authorizationKey", err);
                    return reject(err);
                }

                const authorizationKey = randomBuffer.toString("hex");
                dsuWorker.authorizationKey = authorizationKey;
                console.log(`[CloudWallet] Starting worker for handling seed ${seed}`);
                const worker = new Worker(dsuBootPath, {
                    workerData: {
                        seed,
                        authorizationKey,
                        cookie
                    },
                });

                worker.on("message", (message) => {
                    if (message.error) {
                        dsuWorkers[seed] = null;
                        return reject(message.error);
                    }
                    if (message.port) {
                        console.log(
                            `[CloudWallet] Running worker on PORT ${message.port} for seed ${seed}. Startup took ${getElapsedTime(
                                workerStartTime
                            )}`
                        );
                        dsuWorker.port = message.port;
                        resolve(worker);
                    }
                });
                worker.on("error", (error) => {
                    console.log("[CloudWallet] worker error", error);
                });
                worker.on("exit", (code) => {
                    if (code !== 0) {
                        console.log(`[CloudWallet] Worker stopped with exit code ${code}`);
                        // remove the worker from list in order to be recreated when needed
                        delete dsuWorkers[seed];
                    }
                });

                dsuWorker.terminate = function () {
                    worker.terminate();
                };
            });
        }),
    };
    dsuWorkers[seed] = dsuWorker;
    return dsuWorker;
}

function forwardRequestToWorker(dsuWorker, req, res) {
    const method = req.method;
    const { keySSI } = req.params;
    let requestedPath = req.url.substr(req.url.indexOf(keySSI) + keySSI.length);
    if (!requestedPath) {
        requestedPath = "/";
    }
    if (!requestedPath.startsWith("/")) {
        requestedPath = `/${requestedPath}`;
    }

    const options = {
        hostname: "localhost",
        port: dsuWorker.port,
        path: requestedPath,
        method,
        headers: {
            authorization: dsuWorker.authorizationKey
        },
    };

    if(req.headers.cookie){
        options.headers.cookie = req.headers.cookie
    }

    if (req.headers["content-type"]) {
        options.headers["content-type"] = req.headers["content-type"];
    }

    const workerRequest = http.request(options, (response) => {
        const { statusCode, headers } = response;
        res.statusCode = statusCode;
        const contentType = headers ? headers["content-type"] : null;
        res.setHeader("Content-Type", contentType || "text/html");

        if (statusCode < 200 || statusCode >= 300) {
            return res.end();
        }

        let data = [];
        response.on("data", (chunk) => {
            data.push(chunk);
        });

        response.on("end", () => {
            try {
                const bodyContent = $$.Buffer.concat(data);
                res.statusCode = statusCode;
                res.end(bodyContent);
            } catch (err) {
                console.log("[CloudWallet] worker response error", err);
                res.statusCode = 500;
                res.end();
            }
        });
    });
    workerRequest.on("error", (err) => {
        console.log("[CloudWallet] worker request error", err);
        res.statusCode = 500;
        res.end();
    });

    if (method === "POST" || method === "PUT") {
        let data = [];
        req.on("data", (chunk) => {
            console.log("[CloudWallet] data.push(chunk);", chunk);
            data.push(chunk);
        });

        req.on("end", () => {
            try {
                const bodyContent = $$.Buffer.concat(data);
                workerRequest.write(bodyContent);
                workerRequest.end();
            } catch (err) {
                console.log("[CloudWallet] worker response error", err);
                res.statusCode = 500;
                res.end();
            }
        });
        return;
    }
    workerRequest.end();
}

function init(server) {
    console.log(`Registering CloudWallet component`);

    dsuBootPath = config.getConfig("componentsConfig", "cloudWallet", "dsuBootPath");

    if (dsuBootPath.startsWith(".")) {
        dsuBootPath = path.resolve(path.join(process.env.PSK_ROOT_INSTALATION_FOLDER, dsuBootPath));
    }

    console.log(`[CloudWallet] Using boot script for worker: ${dsuBootPath}`);

    //if a listening event is fired from this point on...
    //it means that a restart was triggered
    server.on("listening", () => {
        console.log(`[CloudWallet] Restarting process in progress...`);
        console.log(`[CloudWallet] Stopping a number of ${Object.keys(dsuWorkers).length} thread workers`);
        for (let seed in dsuWorkers) {
            let worker = dsuWorkers[seed];
            if (worker && worker.terminate) {
                worker.terminate();
            }
        }
    });
}

function handleCloudWalletRequest(request, response) {
    const { keySSI } = request.params;

    let dsuWorker = dsuWorkers[keySSI];
    if (!dsuWorker) {
        dsuWorker = addDsuWorker(keySSI, request.headers.cookie);
    }

    dsuWorker.resolver
        .then(() => {
            forwardRequestToWorker(dsuWorker, request, response);
        })
        .catch((error) => {
            console.log("[CloudWallet] worker resolver error", error);
            response.setHeader("Content-Type", "text/html");
            response.statusCode = 400;
            response.end(INVALID_DSU_HTML_RESPONSE);
        });
}

module.exports = {
    init,
    handleCloudWalletRequest,
};
