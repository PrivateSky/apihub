function setupRequestEnhancements(server) {
    const logger = $$.getLogger("setupRequestEnhancements", "apihub/requestEnhancements");

    const constants = require("./../../moduleConstants");

	server.use(function (req, res, next) {
	    const logs = [];
        req.log = function(...args){
            logs.push(args);
        };

        req.getLogs = function(){
            return logs;
        }

		next();
	});

    logger.info(`${constants.LOG_IDENTIFIER}`, "Request API enhancements were set up.");
}

module.exports = setupRequestEnhancements;
