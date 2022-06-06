module.exports = async () => {
    //we inject a supplementary tag in order make it more clear the source of the log
    let originalLog = console.log;
    console.log = function (...args) {
        originalLog("\t[StreamHandler]", ...args);
    };

    const worker_threads = "worker_threads";
    const { parentPort, workerData } = require(worker_threads);
    console.log(`Node worker started for: `, workerData);

    const resolver = require("opendsu").loadApi("resolver");
    const dsu = await $$.promisify(resolver.loadDSU)(workerData.keySSI);

    parentPort.postMessage("ready");

    const CHUNK_SIZE = 1024 * 1024;

    parentPort.on("message", async (task) => {
        console.log("Handling task", task);
        const { requestedPath, range } = task;

        try {
            const start = Number(range.replace(/\D/g, ""));
            const end = start + CHUNK_SIZE;

            const streamRange = { start, end };
            const { totalSize, stream } = await $$.promisify(dsu.createBigFileReadStreamWithRange)(requestedPath, streamRange);
            const actualEnd = Math.min(end, totalSize - 1);
            const contentLength = actualEnd - start + 1;
            const headers = {
                "Content-Range": `bytes ${start}-${actualEnd}/${totalSize}`,
                "Accept-Ranges": "bytes",
                "Content-Length": contentLength,
                "Content-Type": "video/mp4",
            };

            function streamToBuffer(stream) {
                const chunks = [];
                return new Promise((resolve, reject) => {
                    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
                    stream.on("error", (err) => reject(err));
                    stream.on("end", () => resolve(Buffer.concat(chunks)));
                });
            }
            const buffer = await streamToBuffer(stream);

            parentPort.postMessage({ result: { headers, buffer } });
        } catch (error) {
            parentPort.postMessage({ error });
        }
    });

    process.on("uncaughtException", (error) => {
        console.error("[StreamHandler] uncaughtException inside node worker", error);

        setTimeout(() => process.exit(1), 100);
    });
};
