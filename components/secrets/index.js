const fs = require("fs");

function secrets(server) {
  const fs = require('fs');
  server.get("/getSecret/:appName/:userId", function (request, response) {
    let userId = request.params.userId;
    let appName = request.params.appName;
    let result;
    const fileDir = `${server.rootFolder}/secrets/${appName}`
    try {
      if (fs.existsSync(`${server.rootFolder}/secrets/${appName}/${userId}.json`)) {
        result = fs.readFileSync(`${fileDir}/${userId}.json`);
        if (result) {
          response.statusCode = 200;
          response.end(JSON.stringify({secret: result.toString()}));
        } else {
          response.statusCode = 404;
          response.end(JSON.stringify({error: `Couldn't find a secret for ${userId}`}));
        }
      } else {
        response.statusCode = 204;
        response.end(JSON.stringify({error: `${userId} not found`}));
      }

    } catch (e) {
      response.statusCode = 405;
      response.end(JSON.stringify(e));
    }
  });

  server.put('/putSecret/:appName/:userId', function (request, response) {
    let userId = request.params.userId;
    let appName = request.params.appName;
    let data = []
    request.on('data', (chunk) => {
      data.push(chunk);
    });

    request.on('end', async () => {
      try {
        let body = Buffer.concat(data).toString();
        let msgToPersist = JSON.parse(body).secret;
        const fileDir = `${server.rootFolder}/secrets/${appName}`
        if (!fs.existsSync(fileDir)) {
          fs.mkdirSync(fileDir, {recursive: true});
        }
        if (fs.existsSync(`${fileDir}/${userId}.json`)) {
          response.statusCode = 403;
          response.end(err);
        } else {
          fs.writeFileSync(`${fileDir}/${userId}.json`, msgToPersist);
          response.statusCode = 200;
          response.end();
        }

      } catch (e) {
        response.statusCode = 500;
        response.end(e);
      }
    })
  });
}

module.exports = secrets;
