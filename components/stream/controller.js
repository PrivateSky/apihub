const syndicate = require("syndicate");

const dsuWorkers = {};

function getNodeWorkerBootScript() {
    const openDSUScriptPath = global.bundlePaths.openDSU.replace(/\\/g, "\\\\").replace(".js", "");
    return `
        require("${openDSUScriptPath}");
        (${require("./worker-script").toString()})();
    `;
}

async function handleStreamRequest(request, response) {
    const { keySSI } = request.params;
    let requestedPath = request.url.substr(request.url.indexOf(keySSI) + keySSI.length);
    if (!requestedPath) {
        requestedPath = "/";
    }
    if (!requestedPath.startsWith("/")) {
        requestedPath = `/${requestedPath}`;
    }

    let range = request.headers.range;
    if (!range) {
        response.statusCode = 400;
        return response.end("Requires Range header");
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
        response.writeHead(206, taskResult.headers);
        response.end(taskResult.buffer);
    } catch (error) {
        console.log("[Stream] error", error);
        response.statusCode = 500;
        return response.end(error);
    }
}

module.exports = {
    handleStreamRequest,
};
