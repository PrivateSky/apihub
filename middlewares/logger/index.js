function Logger(server) {
  console.log(`Registering Logger middleware`);

  const getRequestDuration = (start) => {
    const diff = process.hrtime(start);
    return (diff[0] * 1e9 + diff[1]) / 1e6;
  };

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
      let log = `${remoteAddress} - [${datetime}] ${method}:${url} ${statusCode} ${durationInMilliseconds.toLocaleString()}ms`;
      console.log(log);
    });

    next();
  });
}

module.exports = Logger;
