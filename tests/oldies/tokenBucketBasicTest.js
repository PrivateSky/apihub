require("../../../../psknode/bundles/pskruntime");
require('../../../engine/core');
const assert = require('double-check').assert;
const TokenBucket = require('../../libs/TokenBucket');


const flow = $$.flow.describe('tokenBucketBasicTest', {
    init: function(callback) {
        this.tokenBucket = new TokenBucket();

        this.testLimit('costLow',    TokenBucket.prototype.COST_LOW, 600);
        this.testLimit('costMedium', TokenBucket.prototype.COST_MEDIUM, 60);
        this.testLimit('costHigh',   TokenBucket.prototype.COST_HIGH, 12);
        callback();
    },
    testLimit: function(key, cost, iterations) {
        for(let i = 0; i < iterations; ++i) {
            this.tokenBucket.takeToken(key, cost, function(err, limit) {
                assert.false(err, 'Limit was reached too fast, remaining ' + limit);
            });
        }
        this.tokenBucket.takeToken(key, cost, function(err, limit) {
           assert.true(err, 'Limit was too permissive, remaining ' + limit);
        });
    }
})();


assert.callback('tokenBucketBasicTest', function(callback) {
    flow.init(callback);
}, 1000);
