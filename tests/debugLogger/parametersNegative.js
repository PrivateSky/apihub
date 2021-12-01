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

          // POST REQUEST
          const postData = {
            message: 'This is a new message',
          };
          var postOptions = {
            host: 'localhost',
            port,
            path: `/log/add/${anchorID}/info`,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          };

          var req = http.request(postOptions, async (res) => {
            assert.true(res.statusCode === 200, 'Response error');
            let data = '';
            res.setEncoding('utf8');

            res.on('data', function (chunk) {
              data += chunk;
            });

            res.on('end', async () => {
              data = await JSON.parse(data);
              assert.true(data.anchorID === anchorID, 'Response error, anchorId');
              assert.true(data.level === 'info', 'Response error, level');
              assert.true(data.message === postData.message, 'Response error, message');

              // GET REQUEST
              var getOptions = {
                host: 'localhost',
                port,
                path: `/log/get/${anchorID}?level=randomStr&from=randomStr&to=randomStr`,
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
            });
          });

          req.on('error', (e) => {
            assert.true(false, 'Problem with request');
            throw e;
          });

          req.write(JSON.stringify(postData));
          req.end();
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
