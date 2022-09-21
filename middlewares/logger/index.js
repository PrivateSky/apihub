function Logger(server) {
    const logger = $$.getLogger("Logger", "apihub/logger");
    logger.info(`Registering Logger middleware`);
    
    const getRequestDuration = (start) => {
        const diff = process.hrtime(start);
        return (diff[0] * 1e9 + diff[1]) / 1e6;
    };
    
  const { getConfig } = require("../../config");
  const port = getConfig('port');

  server.use(function (req, res, next) {
    const {
      method,
      url,
      connection: { remoteAddress },
    } = req;

    const start = process.hrtime();
    const datetime = new Date().toISOString();
    let durationInMilliseconds;

    res.on('finish', () => {
      const { statusCode } = res;
      durationInMilliseconds = getRequestDuration(start);
      let log = `${remoteAddress}:${port} - [${datetime}] ${method}:${url} ${statusCode} ${durationInMilliseconds.toLocaleString()}ms`;
      logger.info(log);
      if(req.getLogs){
          const visualIndex = "\t";
          const requestLogs = req.getLogs();
          if(requestLogs.length > 0){
              logger.info("Request logs:");
              for(let i=0; i<requestLogs.length; i++){
                  if(Array.isArray(requestLogs)){
                      logger.info(visualIndex, ...requestLogs[i]);
                  }else{
                      logger.info(visualIndex, requestLogs[i]);
                  }
              }
              logger.info("\n");
          }
      }
    });

    next();
  });
}

module.exports = Logger;
