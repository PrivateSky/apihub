
const http = require("http");
const https = require("https");

function makeRequest(url, method = 'GET', requestData, requestOptions = {}) {
    return new Promise((resolve, reject) => {
        const myURL = new URL(url);

        const options = {
            hostname: myURL.hostname,
            path: myURL.pathname,
            protocol: myURL.protocol,
            port: myURL.port,
            method: method,
            headers: getHeaders(requestData, requestOptions.headers)
        };

        const request = (options.protocol === 'https:' ? https : http).request(options, (response) => {
            let data = [];
            
            response.on('data', (chunk) => {
                data.push(chunk);
            });

            response.on('end', () => {
                const stringData = data.map((item) => item.toString()).join('')

                return resolve({
                    statusCode: response.statusCode,
                    body: isJSON(stringData) ? JSON.parse(stringData) : stringData
                });
            });
        }).on("error", (err) => {
            return reject({
                statusCode: err.statusCode,
                body: err.message || 'Internal error'
            });
        });

        if ((method === 'POST' || method === 'PUT') && requestData) {
            request.write(typeof requestData === 'object' ? JSON.stringify(requestData) : requestData);
        }

        request.end();
    })
}

function isJSON(data) {
    try {
        JSON.parse(data)
    } catch {
        return false;
    }

    return true;
}

function getHeaders(data, headers) {
    const dataString = data ? JSON.stringify(data) : null;
    return Object.assign({}, { 'Content-Type': 'application/json' }, dataString ? { 'Content-Length': dataString.length } : null, headers);
};

module.exports = makeRequest;
