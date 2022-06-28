require("../../../../psknode/bundles/testsRuntime");
const { launchApiHubTestNode } = require("../../../../psknode/tests/util/tir");
const dc = require("double-check");
const { assert } = dc;

const DOMAIN = "default";
const FILE_CHUNK_SIZE = 1024 * 1024; // 1MB
const ORIGINAL_FILE_SIZE = 2 * FILE_CHUNK_SIZE;

const fs = require("fs");
const path = require("path");
const crypto = require("pskcrypto");
const opendsu = require("opendsu");
const http = opendsu.loadApi("http");
const doPut = $$.promisify(http.doPut);

function generateRandomFile(filePath, fileSize) {
    const writer = fs.createWriteStream(filePath);
    console.log(`Writing ${fileSize} bytes to ${filePath}`);

    return new Promise((resolve, reject) => {
        const step = 1000;
        let i = fileSize;
        write();
        function write() {
            let ok = true;
            do {
                const chunkSize = i > step ? step : i;
                const buffer = crypto.randomBytes(chunkSize);

                i -= chunkSize;
                if (i === 0) {
                    // Last time!
                    writer.write(buffer, (error) => {
                        if (error) {
                            return reject(error);
                        }
                        resolve();
                    });
                } else {
                    // See if we should continue, or wait.
                    // Don't pass the callback, because we're not done yet.
                    ok = writer.write(buffer);
                }
            } while (i > 0 && ok);

            if (i > 0) {
                // Had to stop early!
                // Write some more once it drains.
                writer.once("drain", write);
            }
        }
    });
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function compareOriginalFileWithOneFromDSU(originalFilePath, chunkSize, streamUrl) {
    const originalFileReadStream = fs.createReadStream(originalFilePath, { highWaterMark: chunkSize });
    let startIndex = 0;
    for await (const originalChunk of originalFileReadStream) {
        // not all time is the highWaterMark enforced, so we need to get the byteLength of the chunk that was actually read
        const actualChunkSize = originalChunk.byteLength;
        const streamRange = { start: startIndex, end: startIndex + actualChunkSize - 1 };
        console.log(`Checking chunk start: ${streamRange.start}, end: ${streamRange.end}, size: ${actualChunkSize}`);

        const streamResonse = await http.fetch(streamUrl, {
            headers: {
                range: `bytes=${streamRange.start}-${streamRange.end}`,
            },
        });
        if (!streamResonse.ok) {
            throw new Error("Stream fetch error", streamResonse);
        }
        const dsuFileBuffer = await streamResonse.arrayBuffer();
        console.log("dsuFileBuffer size", dsuFileBuffer.byteLength);

        if (Buffer.compare(originalChunk, dsuFileBuffer) !== 0) {
            console.log("Buffers are not the same");
            console.log("originalChunk", originalChunk, originalChunk.byteLength);
            console.log("dsuFileBuffer", dsuFileBuffer, dsuFileBuffer.byteLength);
        }

        assert.true(Buffer.compare(originalChunk, dsuFileBuffer) === 0, "Buffers are not the same");

        startIndex += actualChunkSize;
    }
}

async function createWalletWithDSU(testFolder) {
    const port = await $$.promisify(launchApiHubTestNode)(10, testFolder);
    const apiHubUrl = `http://localhost:${port}`;
    const userId = crypto.randomBytes(16).toString("hex");

    const walletId = await doPut(`${apiHubUrl}/stream/${DOMAIN}/create-wallet/${userId}`, {});

    console.log(`Created walletId: ${walletId}`);

    const dsuReadId = await doPut(`${apiHubUrl}/cloud-wallet/${walletId}/create-dsu`, {});

    console.log(`Created DSU with dsuReadId: ${dsuReadId}`);

    return { apiHubUrl, walletId, dsuReadId };
}

async function uploadFileInChunks(testFolder, fileChunkCount) {
    const { apiHubUrl, walletId, dsuReadId } = await createWalletWithDSU();

    const originalFilePath = path.join(testFolder, "original");
    await generateRandomFile(originalFilePath, ORIGINAL_FILE_SIZE);

    let uploadChunkSize = Math.ceil(ORIGINAL_FILE_SIZE / fileChunkCount);
    let fileChunkStart = 0;
    while (true) {
        const fileChunkEnd = Math.min(fileChunkStart + uploadChunkSize, ORIGINAL_FILE_SIZE) - 1;
        console.log(`Uploading file chunk from start ${fileChunkStart} to end ${fileChunkEnd}...`);
        const originalFileChunkStream = fs.createReadStream(originalFilePath, {
            start: fileChunkStart,
            end: fileChunkEnd,
        });
        await doPut(`${apiHubUrl}/cloud-wallet/${walletId}/append/${dsuReadId}/data`, originalFileChunkStream);

        fileChunkStart = fileChunkEnd + 1;
        if (fileChunkStart >= ORIGINAL_FILE_SIZE) {
            break;
        }
    }
    // compare the original file and the one saved inside the DSU using various buffer sizes
    const streamUrl = `${apiHubUrl}/stream/${dsuReadId}/data`;
    await compareOriginalFileWithOneFromDSU(originalFilePath, FILE_CHUNK_SIZE, streamUrl);
    await compareOriginalFileWithOneFromDSU(originalFilePath, Math.floor(FILE_CHUNK_SIZE / 2), streamUrl);
    await compareOriginalFileWithOneFromDSU(originalFilePath, Math.floor(FILE_CHUNK_SIZE / 3), streamUrl);
    await compareOriginalFileWithOneFromDSU(originalFilePath, Math.floor(FILE_CHUNK_SIZE / 4), streamUrl);
    await compareOriginalFileWithOneFromDSU(originalFilePath, Math.floor(FILE_CHUNK_SIZE / 5), streamUrl);
}

assert.callback(
    "Append unexisting file test",
    async (testFinished) => {
        try {
            const testFolder = await $$.promisify(dc.createTestFolder)("createWalletTest");
            const { apiHubUrl, walletId, dsuReadId } = await createWalletWithDSU();

            const originalFilePath = path.join(testFolder, "original");
            await generateRandomFile(originalFilePath, ORIGINAL_FILE_SIZE);

            const originalFileReadStream = fs.createReadStream(originalFilePath);
            await doPut(`${apiHubUrl}/cloud-wallet/${walletId}/append/${dsuReadId}/data`, originalFileReadStream);

            // compare the original file and the one saved inside the DSU using various buffer sizes
            const streamUrl = `${apiHubUrl}/stream/${dsuReadId}/data`;
            await compareOriginalFileWithOneFromDSU(originalFilePath, FILE_CHUNK_SIZE, streamUrl);
            await compareOriginalFileWithOneFromDSU(originalFilePath, Math.floor(FILE_CHUNK_SIZE / 2), streamUrl);
            await compareOriginalFileWithOneFromDSU(originalFilePath, Math.floor(FILE_CHUNK_SIZE / 3), streamUrl);
            await compareOriginalFileWithOneFromDSU(originalFilePath, Math.floor(FILE_CHUNK_SIZE / 4), streamUrl);
            await compareOriginalFileWithOneFromDSU(originalFilePath, Math.floor(FILE_CHUNK_SIZE / 5), streamUrl);

            testFinished();
        } catch (error) {
            console.log(error);
        }
    },
    60000
);

assert.callback(
    "Append existing file by splitting original file in 2 chunks test",
    async (testFinished) => {
        try {
            const testFolder = await $$.promisify(dc.createTestFolder)("createWalletTest");
            await uploadFileInChunks(testFolder, 2);

            testFinished();
        } catch (error) {
            console.log(error);
        }
    },
    60000
);

assert.callback(
    "Append existing file by splitting original file in 3 chunks test",
    async (testFinished) => {
        try {
            const testFolder = await $$.promisify(dc.createTestFolder)("createWalletTest");
            await uploadFileInChunks(testFolder, 3);

            testFinished();
        } catch (error) {
            console.log(error);
        }
    },
    60000
);

assert.callback(
    "Append existing file by splitting original file in 4 chunks test",
    async (testFinished) => {
        try {
            const testFolder = await $$.promisify(dc.createTestFolder)("createWalletTest");
            await uploadFileInChunks(testFolder, 4);

            testFinished();
        } catch (error) {
            console.log(error);
        }
    },
    60000
);

assert.callback(
    "Append existing file by splitting original file in 5 chunks test",
    async (testFinished) => {
        try {
            const testFolder = await $$.promisify(dc.createTestFolder)("createWalletTest");
            await uploadFileInChunks(testFolder, 5);

            testFinished();
        } catch (error) {
            console.log(error);
        }
    },
    60000
);
