
const https = require("https");

async function makeRequest(options, data) {
    options.headers = getHeaders(data, options.headers)

    const request = https.request(options, (response) => {
        let data = [];
        response.on('data', (chunk) => {
            data.push(chunk);
        });

        response.on('end', () => {
            return Promise.resolve({ statusCode: res.statusCode, body: data });
        });

    }).on("error", (err) => {
        return Promise.reject({ statusCode: err.statusCode, body: err.message || 'Internal error' });
    });

    request.write(data);
    request.end();
}

function getHeaders(data, headers) {
    const dataString = data ? JSON.stringify(data) : null;
    return Object.assign({}, { 'Content-Type': 'application/json' }, dataString ? { 'Content-Length': dataString.length } : null, headers);
};

module.exports = makeRequest;
