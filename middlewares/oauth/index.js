const openDSU = require("opendsu");
const crypto = openDSU.loadAPI("crypto");

const {sendUnauthorizedResponse} = require("../../utils/middlewares");
const config = require("../../config");

function OAuth(server) {
    console.log(`Registering OAuth middleware`);

    const config = require("../../config");
    const skipOAuth = config.getConfig("skipOAuth");
    const urlsToSkip = skipOAuth && Array.isArray(skipOAuth) ? skipOAuth : [];
    let publicKey;

    function parseCookies(cookies) {
        if (!cookies) {
            return undefined;
        }
        const splitCookies = cookies.split(";");
        const authCookie = splitCookies.find(cookie => cookie.split("=")[0] === "authorization");
        if (!authCookie) {
            return undefined;
        }
        let token = authCookie.split("=")[1];
        if (token === "null") {
            return undefined;
        }

        return token;
    }

    function parseAccessToken(rawAccessToken) {
        let [header, payload, signature] = rawAccessToken.split(".");
        header = JSON.parse($$.Buffer.from(header, "base64").toString())
        payload = JSON.parse($$.Buffer.from(payload, "base64").toString())
        return {
            header, payload, signature
        }
    }

    function getPublicKey(callback) {
        if (publicKey) {
            return callback(undefined, publicKey);
        }
        const jwksEndpoint = config.getConfig("oauthJWKSEndpoint");
        const url = new URL(jwksEndpoint);
        let get;
        switch (url.protocol) {
            case 'https:':
                get = require("https").get
                break
            case 'http:':
                get = require("http").get
                break
            default:
                return callback(Error('Unsupported URL protocol.'));
        }

        get(url.href, (res) => {
            let rawData = '';
            res.on('data', (chunk) => {
                rawData += chunk;
            });
            res.on('end', () => {
                console.log(rawData);
                try {
                    const parsedData = JSON.parse(rawData);
                    publicKey =parsedData.keys.find(key => key.use === "sig");
                    callback(undefined, publicKey);
                } catch (e) {
                    console.error(e.message);
                }
            });
        });
    }

    server.use(function (req, res, next) {
        let {url} = req;
        let rawAccessToken = parseCookies(req.headers.cookie);

        const canSkipOAuth = urlsToSkip.some((urlToSkip) => url.indexOf(urlToSkip) === 0);
        if (url === "/" || canSkipOAuth) {
            next();
            return;
        }

        if (!config.getConfig("enableLocalhostAuthorization") && req.headers.host.indexOf("localhost") === 0) {
            next();
            return;
        }

        if (!rawAccessToken) {
            return sendUnauthorizedResponse(req, res, "Missing required Authorization header");
        }

        getPublicKey((err, publicKey) => {
            if (err) {
                return sendUnauthorizedResponse(req, res, "Unable to get JWKS");
            }

            crypto.joseAPI.verify(rawAccessToken, publicKey, (err) => {
                if (err) {
                    return sendUnauthorizedResponse(req, res, "Failed to validate token");
                }

                next();
            });
        })
    });
}

module.exports = OAuth;
