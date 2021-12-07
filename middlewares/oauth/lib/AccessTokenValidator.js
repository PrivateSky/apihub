const {sendUnauthorizedResponse} = require("../../../utils/middlewares");
const util = require("./util");

function AccessTokenValidator(server) {
    console.log(`Registering AccessTokenValidator middleware`);

    const config = require("../../../config");
    const skipOAuth = config.getConfig("skipOAuth");
    const urlsToSkip = skipOAuth && Array.isArray(skipOAuth) ? skipOAuth : [];

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

    server.use(function (req, res, next) {
        let {url} = req;
        let {rawAccessToken: authorisation} = parseCookies(req.headers.cookie);

        const canSkipOAuth = urlsToSkip.some((urlToSkip) => url.indexOf(urlToSkip) === 0);
        if (url === "/" || canSkipOAuth) {
            next();
            return;
        }

        if (!config.getConfig("enableLocalhostAuthorization") && req.headers.host.indexOf("localhost") === 0) {
            next();
            return;
        }

        if (!authorisation) {
            res.writeHead(301, {Location: "/"});
            res.end();
            return;
        }

        const jwksEndpoint = config.getConfig("oauthJWKSEndpoint");
        util.validateAccessToken(jwksEndpoint, authorisation,  (err) => {
            if (err) {
                return sendUnauthorizedResponse(req, res, "Failed to validate token");
            }

            next();
        })
    });
}

module.exports = AccessTokenValidator;