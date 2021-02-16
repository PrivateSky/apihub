function DebugLogger(server) {
  const { responseModifierMiddleware, requestBodyJSONMiddleware } = require('../../utils/middlewares');
  const { createHandlerAppendToLog, createHandlerReadFromLog } = require('./controllers');

  const appendToLog = createHandlerAppendToLog(server);
  const readFromLog = createHandlerReadFromLog(server);

  server.use(`/log/*`, responseModifierMiddleware);
  server.use(`/log/*`, requestBodyJSONMiddleware);

  server.post(`/log/add/:anchorID/:logLevel`, appendToLog);
  server.get(`/log/get/:anchorID`, readFromLog);
}

module.exports = DebugLogger;
