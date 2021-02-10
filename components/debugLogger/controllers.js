const url = require('url');
const fs = require('fs');
const path = require('swarmutils').path;
const API_HUB = require('apihub');

let config = API_HUB.getServerConfig();
const rootFolder = arguments.rootFolder || path.resolve(config.storage);

const levels = {
  error: 'error',
  warning: 'warning',
  info: 'info',
  debug: 'debug',
};

const levelsNumbers = {
  [levels.error]: 0,
  [levels.warning]: 1,
  [levels.info]: 2,
  [levels.debug]: 3,
};

function createHandlerAppendToLog(server) {
  return function appendToLog(request, response) {
    if (!request.body || !request.body.message) {
      response.send(400);
      return;
    }
    const message = request.body && request.body.message;
    const anchorID = request.params.anchorID;
    const logLevel = levelsNumbers[request.params.logLevel] || levelsNumbers[levels.info];

    let data;

    if (message && typeof message === 'string') {
      data = { date: new Date().toISOString(), level: logLevel, anchorID: anchorID, message: message };
    } else {
      response.send(400);
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const fileName = `${rootFolder}/${today}.json`;

      const exists = fs.existsSync(fileName);

      if (exists) {
        const existingData = fs.readFileSync(fileName);
        const json = JSON.parse(existingData);
        json.push(data);
        fs.writeFile(fileName, JSON.stringify(json), (err) => {
          if (err) {
            response.send(500);
            console.log(err);
            return;
          } else {
            response.send(200, data);
            return;
          }
        });
      } else {
        fs.writeFile(fileName, JSON.stringify([data]), (err) => {
          if (err) {
            response.send(500);
            console.log(err);
            return;
          } else {
            response.send(200, data);
            return;
          }
        });
      }
    } catch (err) {
      console.log(err);
      console.log('Error writing file to disk');
    }
  };
}

function createHandlerReadFromLog(server) {
  return function readFromLog(request, response) {
    const today = new Date().toISOString().split('T')[0];
    const anchorID = request.params.anchorID;
    const queryObject = url.parse(request.url, true).query;
    const logLevel = levelsNumbers[queryObject.logLevel || levels.info];

    let fromDate = queryObject.from ? Date.parse(queryObject.from) : Date.parse(today);
    const toDate = queryObject.to ? Date.parse(queryObject.to) : Date.parse(today);
    const oneDay = 1000 * 60 * 60 * 24;

    let promises = [];

    for (fromDate; fromDate <= toDate; fromDate += oneDay) {
      const date = new Date(fromDate).toISOString().split('T')[0];
      const fileName = `${rootFolder}/${date}.json`;
      const exists = fs.existsSync(fileName);

      if (!exists) {
        continue;
      }

      promises.push(
        new Promise((resolve, reject) => {
          fs.readFile(fileName, (err, data) => {
            if (err) {
              reject(err);
            }
            data = JSON.parse(data);
            data = data.filter((log) => log.anchorID === anchorID);
            data = data.filter((log) =>
              logLevel === levelsNumbers[levels.debug]
                ? log.level === levelsNumbers[levels.info] ||
                  log.level === levelsNumbers[levels.error] ||
                  log.level === levelsNumbers[levels.warning]
                : log.level === logLevel
            );

            resolve(data);
          });
        })
      );
    }

    Promise.all(promises).then((result) => {
      response.send(200, result.flat());
    });
  };
}

module.exports = { createHandlerAppendToLog, createHandlerReadFromLog };
