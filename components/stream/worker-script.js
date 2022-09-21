module.exports = async () => {
    const logger = $$.getLogger("worker-script", "apihub/stream");
    //we inject a supplementary tag in order make it more clear the source of the log

    const worker_threads = "worker_threads";
    const { parentPort, workerData } = require(worker_threads);
    logger.info(`Node worker started for: `, workerData);

    const resolver = require("opendsu").loadApi("resolver");
    const dsu = await $$.promisify(resolver.loadDSU)(workerData.keySSI);

    parentPort.postMessage("ready");

    const CHUNK_SIZE = 1024 * 1024;

    parentPort.on("message", async (task) => {
        logger.info("Handling task", task);
        const { requestedPath } = task;
        let { range } = task;

        try {
            let start;
            let end;

            if (range.indexOf("=") !== -1) {
                range = range.split("=")[1];
            }
            if (range.indexOf("-") !== -1) {
                parts = range.split("-");
                start = parseInt(parts[0], 10);
                if (parts[1]) {
                    end = parseInt(parts[1], 10);
                } else {
                    end = start + CHUNK_SIZE;
                }
            } else {
                start = parseInt(range, 10);
                end = start + CHUNK_SIZE;
            }
            await $$.promisify(dsu.refresh)();

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
        logger.error("[StreamHandler] uncaughtException inside node worker", error);

        setTimeout(() => process.exit(1), 100);
    });
};
