function Logger(server) {
    console.log(`Registering Logger middleware`);
    
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
      console.log(log);
      if(req.getLogs){
          const visualIndex = "\t";
          const requestLogs = req.getLogs();
          if(requestLogs.length > 0){
              console.log("Request logs:");
              for(let i=0; i<requestLogs.length; i++){
                  if(Array.isArray(requestLogs)){
                      console.log(visualIndex, ...requestLogs[i]);
                  }else{
                      console.log(visualIndex, requestLogs[i]);
                  }
              }
              console.log("\n");
          }
      }
    });

    next();
  });
}

module.exports = Logger;
