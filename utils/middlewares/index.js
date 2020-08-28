const responseWrapper = require('../responseWrapper');

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
        request.body = data.length ? JSON.parse(data) : {};
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

module.exports = { requestBodyJSONMiddleware, responseModifierMiddleware, headersMiddleware };