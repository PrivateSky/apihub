const config = require("../../config");


function getApiHubEnclave(server) {

  async function executeRequest(request, response, encrypted) {
    const {domain, enclaveDID} = request.params;
    const domainConfig = config.getDomainConfig(domain);

    if (!domainConfig) {
      response.statusCode = 403;
      response.end(err.message);
      return;
    }

    // TO DO get config data

    let requestObj = await getRequestData(request);

    if (encrypted) {
      requestObj = decryptRequest(requestObj, enclaveDID)
    }
    let Enclave = require("default-enclave");
    let enclave = new Enclave(config.getDomainConfig(domain).enclaveDBName)

    enclave[requestObj.command].call(undefined, requestObj.args, (err, data) => {
      if (err) {
        response.statusCode = 405;
        response.end(JSON.stringify(err));
        return;
      }
      response.statusCode = 200;
      response.end(JSON.stringify(data))
    });
  }

  function decryptRequest(encriptedObj, key) {
    let crypto = require("opendsu").loadApi("crypto");
    const encryptionKey = crypto.deriveEncryptionKey(key);
    const decryptData = crypto.decrypt($$.Buffer.from(JSON.parse(encriptedObj)), encryptionKey);
    return JSON.parse(decryptData.toString());
  }

  async function getRequestData(request) {
    return new Promise((resolve, reject) => {
      let data = [];
      request.on('data', (chunk) => {
        data.push(chunk);
      });
      request.on('end', async () => {
        try {
          let body = Buffer.concat(data).toString();
          let requestObj = JSON.parse(body);
          resolve(requestObj)
        } catch (err) {
          reject(err);
        }
      })
    })
  }

  server.put("/runEnclaveCommand/:domain/:enclaveDID", async (request, response) => {
    try {
      await executeRequest(request, response, false)
    } catch (err) {
      response.statusCode = 500;
      response.end(err.message);
    }

  });

  server.put("/runEnclaveEncryptedCommand/:domain/:enclaveDID", async (request, response) => {
    try {
      await executeRequest(request, response, true)
    } catch (err) {
      response.statusCode = 500;
      response.end(err.message);
    }
  });

}

module.exports.getApiHubEnclave = getApiHubEnclave;
