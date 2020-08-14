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
        request.body = JSON.parse(data);
        next();
    });
}

function responseModifierMiddleware(request, response, next) {
    response.send = (statusCode, body, callback = () => { }) => {
        response.statusCode = statusCode;
        response.write(responseWrapper(body));

        callback();
    };

    next();
}

module.exports = { requestBodyJSONMiddleware, responseModifierMiddleware };