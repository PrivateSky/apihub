require('../../../../psknode/bundles/testsRuntime');
const testIntegration = require('../../../../psknode/tests/util/tir');
const dc = require('double-check');
const http = require('http');
const assert = dc.assert;

assert.callback(
  'Default values test',
  (endTest) => {
    dc.createTestFolder('testFolder', (err, folder) => {
      if (err) {
        assert.true(false, 'Error creating test folder');
        throw err;
      }
      testIntegration.launchApiHubTestNode(10, folder, async (err, port) => {
        try {
          if (err) {
            assert.true(false, 'Error launching api hub');
            throw err;
          }

          let anchorID = Math.random().toString(36).substring(2);

          // GET REQUEST
          var getOptions = {
            host: 'localhost',
            port,
            path: `/log/get/${anchorID}`,
            method: 'GET',
          };

          var getRequest = http.request(getOptions, async (getResponse) => {
            assert.true(getResponse.statusCode === 200, 'Response error');
            let getData = '';
            getResponse.setEncoding('utf8');

            getResponse.on('data', function (chunk) {
              getData += chunk;
            });

            getResponse.on('end', async () => {
              getData = await JSON.parse(getData);
              assert.true(getData && getData.length === 0);
              endTest();
            });
          });

          getRequest.on('error', (e) => {
            assert.true(false, 'Problem with request');
            throw e;
          });
          getRequest.end();
        } catch (error) {
          console.log(error);
          assert.true(false, 'Error during communication');
          endTest();
        }
      });
    });
  },
  20000
);
