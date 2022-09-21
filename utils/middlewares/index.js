const responseWrapper = require('../responseWrapper');
const logger = $$.getLogger("middlewares", "apihub/utils");

function requestBodyJSONMiddleware(request, response, next) {
    /**
     * Prepare headers for response
     */
    response.setHeader('Content-Type', 'application/json');

    const data = [];

    request.on('data', (chunk) => {
        data.push(chunk);
    });

    request.on('end', () => {
        if (!data.length) {
            request.body = {};
            return next();
        }

        let body;

        try {
            body = JSON.parse(data);
        } catch (e) {
            response.statusCode = 500;
            return response.end("Unable to decode JSON request body");
        }
        request.body = body;
        next();
    });
}

function responseModifierMiddleware(request, response, next) {
    if (!response.hasOwnProperty('send')) {
        response.send = function (statusCode, body, callback = response.end) {
            response.statusCode = statusCode;

            if (body) {
                response.write(responseWrapper(body));
            }

            callback.call(response);
            // callback();
        };
    }

    next();
}

function headersMiddleware(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Content-Length, X-Content-Length');
    next();
}

function bodyReaderMiddleware(req, res, next) {
    const data = [];

    req.on('data', (chunk) => {
        data.push(chunk);
    });

    req.on('end', () => {
        req.body = Buffer.concat(data);
        next();
    });
}

function sendUnauthorizedResponse(req, res, reason, error) {
    logger.error(`[Auth] [${req.method}] ${req.url} blocked: ${reason}`, error);
    res.statusCode = 403;
    res.end();
}

module.exports = { requestBodyJSONMiddleware, responseModifierMiddleware, headersMiddleware , bodyReaderMiddleware, sendUnauthorizedResponse};
