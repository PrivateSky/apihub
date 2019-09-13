require("../../../psknode/bundles/pskruntime");
require('../../../modules/virtualmq/flows/CSBmanager');
const assert = require("double-check").assert;
const path = require('path');
const Duplex = require('stream').Duplex;
const fileStateManager = require('../../../libraries/utils/FileStateManager').getFileStateManager();
const os = require('os');

const tempFolder = path.resolve(path.join(os.tmpdir(), 'CSB'));
const numberOfFileVersions = 500;
const fileName = 'test-file';

$$.flow.describe('CSBVersioningTest', {
    init: function (callback) {
        this.cb = callback;
        fileStateManager.saveState([tempFolder], () => {
            this.__initializeCSBManager((err, rootFolder) => {
                assert.false(err, 'Error initializing CSBmanager: ' + (err && err.message));
                this.__getDemoFileStream();
                this.__sequentialWriteFile(numberOfFileVersions, 0, () => {
                    this.__verify();
                });
            });
        });
    },
    __initializeCSBManager: function (callback) {
        this.CSBManager = $$.flow.start('CSBmanager');
        this.CSBManager.init(tempFolder, callback);
    },
    __getDemoFileStream: function () {
        this.demoFileStream = bufferToStream(Buffer.alloc(10, 'a'));
    },
    __writeFile: function (callback) {
        this.CSBManager.write(fileName, this.demoFileStream, (err) => {
            assert.false(err, "Error writing demo file: " + (err && err.message));
            callback();
        });
    },
    __sequentialWriteFile: function (numberOfIterations, currentStep, callback) {
        if (currentStep === numberOfIterations) {
            callback();
            return;
        }

        this.__writeFile(() => {
            this.__sequentialWriteFile(numberOfIterations, ++currentStep, callback);
        });
    },
    __verify: function () {
        this.CSBManager.getVersionsForFile(fileName, (err, files) => {
            assert.equal(files.length, numberOfFileVersions, 'Missing file versions');
            for (let i = 0; i < files; ++i) {
                assert.equal(parseInt(files[i].version), i + 1, 'File versions are not sequential');
            }
            fileStateManager.restoreState();
            this.cb();
        });
    },
})();

assert.callback('CSBVersioningTest', function (callback) {
    $$.flow.start('CSBVersioningTest').init(callback);
}, 2000);


function bufferToStream(buffer) {
    const stream = new Duplex();
    stream.push(buffer);
    stream.push(null);
    return stream;
}