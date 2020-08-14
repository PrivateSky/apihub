
const http = require("http");
const https = require("https");

function getRequest(url) {
    return new Promise((resolve, reject) => {
        (url.includes('https') ? https : http).get(url, (response) => {

            let data = [];
            response.on('data', (chunk) => {
                data.push(chunk);
            });

            response.on('end', () => {
                return resolve({ statusCode: response.statusCode, body: data });
            });

        }).on('error', (e) => {
            return reject({ statusCode: err.statusCode, body: err.message || 'Internal error' });
        });
    })

}

// async function makeRequest(url, method, data, options) {
//     options.headers = getHeaders(data, options.headers);

//     const request = (options.url.includes('https') ? https : http).request(options, (response) => {
//         let data = [];
//         response.on('data', (chunk) => {
//             data.push(chunk);
//         });

//         response.on('end', () => {
//             return Promise.resolve({ statusCode: res.statusCode, body: data });
//         });

//     }).on("error", (err) => {
//         return Promise.reject({ statusCode: err.statusCode, body: err.message || 'Internal error' });
//     });

//     request.write(data);
//     request.end();
// }


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
        console.log(options)
        // URL {
        //     href: 'http://localhost:8080/brick',
        //     origin: 'http://localhost:8080',
        //     protocol: 'http:',
        //     username: '',
        //     password: '',
        //     host: 'localhost:8080',
        //     hostname: 'localhost',
        //     port: '8080',
        //     pathname: '/brick',
        //     search: '',
        //     searchParams: URLSearchParams {},
        //     hash: ''
        //   }
        
        const request = (options.protocol === 'https:' ? https : http).request(options, (response) => {
            let data = [];
            response.on('data', (chunk) => {
                data.push(chunk);
            });

            response.on('end', () => {
                return resolve({ statusCode: response.statusCode, body: data });
            });

        }).on("error", (err) => {
            return reject({ statusCode: err.statusCode, body: err.message || 'Internal error' });
        });

        if ((method === 'POST' || method === 'PUT') && requestData) {
            request.write(typeof requestData === 'object' ? JSON.stringify(requestData) : requestData);
        }

        request.end();
    })
}

function getHeaders(data, headers) {
    const dataString = data ? JSON.stringify(data) : null;
    return Object.assign({}, { 'Content-Type': 'application/json' }, dataString ? { 'Content-Length': dataString.length } : null, headers);
};

module.exports = { getRequest, makeRequest };
