function StopWatchLogger(server) {
  console.log(`Registering StopWatchLogger middleware`);

  server.use(function (req, res, next) {
    let aStartDate = new Date();
    let end = res.end;
    res.end = function (...args) {
			end.call(res, ...args);
			let anEndDate = new Date();
			console.log(`${anEndDate.toISOString()} [${req.method}] ${req.url} took ${anEndDate.getTime() - aStartDate.getTime()}ms.`);
		}
    console.log(`${aStartDate.toISOString()} [${req.method}] ${req.url} received.`);
    next();
  });
}

module.exports = StopWatchLogger;
