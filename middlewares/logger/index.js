function Logger(server) {
  console.log(`Registering Logger middleware`);

  server.use(function (req, res, next) {
    console.log(`[${req.method}] ${req.url}`);
    next();
  });
}

module.exports = Logger;
