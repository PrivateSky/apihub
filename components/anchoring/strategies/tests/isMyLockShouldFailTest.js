require("../../../../../../psknode/bundles/testsRuntime");

const dc = require("double-check");
const assert = dc.assert;
const FSLock = require("../utils/FSLock");
const fs = require("fs");
const path = require("path");
assert.callback("Acquire lock after previous expired", (callback) => {
    dc.createTestFolder("testFolder", (err, folder) => {
        if (err) {
            throw err;
        }

        const filePath = path.join(folder, "testFile");
        const fsLock = new FSLock(filePath, 1000, 1000);
        const newFsLock = new FSLock(filePath, 1000, 1000);

        fsLock.acquireLock((err) => {
            assert.true(typeof err === "undefined");
            setTimeout(async () => {
                try {
                    await $$.promisify(newFsLock.acquireLock)();
                    const isMyLock = await $$.promisify(fsLock.isMyLock)()
                    assert.true(isMyLock === false);
                    callback();
                } catch (e) {
                    assert.true(typeof e === "undefined");
                }
            }, 3000)
        })
    })
}, 5000)