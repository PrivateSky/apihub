require("../../../../../../psknode/bundles/testsRuntime");

const dc = require("double-check");
const assert = dc.assert;
const FSLock = require("../utils/FSLock");
const fs = require("fs");
const path = require("path");
assert.callback("Acquire and release lock", (callback) => {
    dc.createTestFolder("testFolder", (err, folder) => {
        if (err) {
            throw err;
        }

        const filePath = path.join(folder, "testFile");
        const fsLock = new FSLock(filePath, 1000, 1000);
        const newFsLock = new FSLock(filePath, 1000, 1000);

        fsLock.acquireLock(async (err) => {
            assert.true(typeof err === "undefined");
            try {
                let isMyLock = await $$.promisify(fsLock.isMyLock)();
                assert.true(isMyLock);
                await $$.promisify(fsLock.releaseLock)();
                isMyLock = await $$.promisify(fsLock.isMyLock)();
                assert.true(isMyLock === false);
                await $$.promisify(newFsLock.acquireLock)();
                callback();
            } catch (e) {
                console.log(e);
                assert.true(typeof e === "undefined");
            }
        })
    })
}, 1000000)