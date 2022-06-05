function getNodeWorkerBootScript() {
    const openDSUScriptPath = global.bundlePaths.openDSU.replace(/\\/g, "\\\\").replace(".js", "");
    return `
        require("${openDSUScriptPath}");
        (${require("./worker-script").toString()})();
    `;
}

function StreamHandler(server) {
    console.log(`Registering StreamHandler middleware`);

    const syndicate = require("syndicate");

    const dsuWorkers = {};

    // // if a listening event is fired from this point on...
    // // it means that a restart was triggered
    // server.on("listening", () => {
    //     console.log(`[StreamHandler] Restarting process in progress...`);
    //     console.log(`[StreamHandler] Stopping a number of ${Object.keys(dsuWorkers).length} thread workers`);
    //     for (let seed in dsuWorkers) {
    //         let worker = dsuWorkers[seed];
    //         if (worker && worker.terminate) {
    //             worker.terminate();
    //         }
    //     }
    // });

    server.use(async (req, res, next) => {
        const { method, url } = req;

        if (url.indexOf("stream") === -1) {
            // not an stream related request so skip it
            next();
            return;
        }

        let keySSI = url.substr(url.indexOf("stream") + "stream".length + 1);
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

        let range = req.headers.range;
        if (!range) {
            res.statusCode = 400;
            return res.end("Requires Range header");
        }

        let dsuWorker = dsuWorkers[keySSI];
        if (!dsuWorker) {
            dsuWorker = syndicate.createWorkerPool({
                bootScript: getNodeWorkerBootScript(),
                maximumNumberOfWorkers: 1,
                workerOptions: {
                    eval: true,
                    workerData: {
                        keySSI,
                    },
                },
            });
            dsuWorkers[keySSI] = dsuWorker;
        }

        const sendTaskToWorker = (task, callback) => {
            dsuWorker.addTask(task, (err, message) => {
                if (err) {
                    return callback(err);
                }

                let { error, result } = typeof Event !== "undefined" && message instanceof Event ? message.data : message;

                if (error) {
                    return callback(error);
                }

                if (result && result.buffer && result.buffer instanceof Uint8Array) {
                    result.buffer = $$.Buffer.from(result.buffer);
                }

                callback(error, result);
            });
        };

        const task = {
            requestedPath,
            range,
        };

        try {
            const taskResult = await $$.promisify(sendTaskToWorker)(task);
            res.writeHead(206, taskResult.headers);
            res.end(taskResult.buffer);
        } catch (error) {
            console.log("[StreamHandler] error", error);
            res.statusCode = 500;
            return res.end(error);
        }
    });
}

module.exports = StreamHandler;
