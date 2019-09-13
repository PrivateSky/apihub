require("../testBase");
const assert = require('double-check').assert;
const TokenBucket = require('../../../modules/virtualmq/libs/TokenBucket');

const initParamsToTest = [
    [0, 1, 2],
    [null, 11, 12],
    [-1, 31, 32],
    [[], 41, 42],
    [{}, 51, 52],
    [function () {}, 61, 62],
    [-Infinity, 71, 72],
    [NaN, 81, 82]
];

const takeTokenParams = [-1, 0, undefined, null, {}, [], -Infinity, Infinity, NaN];

const flow = $$.flow.describe('tokenBucketParametersTest', {
    init: function (callback) {
        this.testInitParameters();
        this.testTakeTokenParameters();
        callback();
    },
    testInitParameters: function () {
        for (let i = 0; i < initParamsToTest.length; ++i) {
            let error = false;
            try {
                new TokenBucket(...initParamsToTest[i]);
            } catch (e) {
                error = true;
            }

            assert.true(error, 'Parameters passed when they should have not ' + JSON.stringify(initParamsToTest[i]));
        }
    },
    testTakeTokenParameters: function () {
        let tokenBucket = new TokenBucket();

        for (let i = 0; i < takeTokenParams.length; ++i) {
            tokenBucket.takeToken('testKey', takeTokenParams[i], function (err, limit) {
                assert.true(err === TokenBucket.ERROR_BAD_ARGUMENT, 'takeToken parameter passed when it should have not ' + JSON.stringify(takeTokenParams[i]));
            });
        }
    }
})();

assert.callback('tokenBucketParametersTest', function (callback) {
    flow.init(callback);
}, 1000);
