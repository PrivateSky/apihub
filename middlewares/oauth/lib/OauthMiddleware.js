const {sendUnauthorizedResponse} = require("../../../utils/middlewares");
const util = require("./util");
const urlModule = require("url");

function OAuthMiddleware(server) {
    console.log(`Registering OAuthMiddleware`);

    const path = require("path");
    const CURRENT_PRIVATE_KEY_PATH = path.join(server.rootFolder, "currentPrivateKey");
    const urlsToSkip = util.getUrlsToSkip();
    const config = require("../../../config");
    const oauthConfig = config.getConfig("oauthConfig");
    const WebClient = require("./WebClient");
    const webClient = new WebClient(oauthConfig);
    const errorMessages = require("./errorMessages");

    function startAuthFlow(req, res) {
        const loginContext = webClient.getLoginInfo(oauthConfig);
        util.encryptLoginInfo(CURRENT_PRIVATE_KEY_PATH, loginContext, (err, encryptedContext) => {
            if (err) {
                return sendUnauthorizedResponse(req, res, "Unable to encrypt login info");
            }

            res.writeHead(301, {
                Location: loginContext.redirect,
                "Set-Cookie": `loginContextCookie=${encryptedContext}; Max-Age=${oauthConfig.sessionTimeout / 1000}`
            });
            res.end();
        })
    }

    function loginCallbackRoute(req, res) {
        let cbUrl = req.url;
        let query = urlModule.parse(cbUrl, true).query;
        const {loginContextCookie} = util.parseCookies(req.headers.cookie);
        util.decryptLoginInfo(CURRENT_PRIVATE_KEY_PATH, loginContextCookie, (err, loginContext) => {
            if (err) {
                return sendUnauthorizedResponse(req, res, "Unable to decrypt login info");
            }
            const queryCode = query['code'];
            const queryState = query['state'];


            webClient.loginCallback({
                clientState: loginContext.state,
                clientFingerprint: loginContext.fingerprint,
                clientCode: loginContext.codeVerifier,
                queryCode,
                queryState,
                origin: req.headers.host,
            }, (err, tokenSet) => {
                if (err) {
                    return sendUnauthorizedResponse(req, res, "Unable to get token set");
                }

                util.encryptAccessToken(CURRENT_PRIVATE_KEY_PATH, tokenSet.access_token, (err, encryptedAccessToken) => {
                    if (err) {
                        return sendUnauthorizedResponse(req, res, "Unable to encrypt access token");
                    }

                    res.writeHead(301, {
                        Location: "/",
                        "Set-Cookie": [`accessTokenCookie=${encryptedAccessToken}; Max-Age=${oauthConfig.sessionTimeout / 1000}`, "isActiveSession=true"]
                    });
                    res.end();
                })
            });
        })
    }

    function logout(res) {
        const urlModule = require("url");
        const logoutUrl = urlModule.parse(oauthConfig.client.logoutUrl);
        logoutUrl.query = {
            post_logout_redirect_uri: oauthConfig.client.postLogoutRedirectUrl,
            client_id: oauthConfig.client.clientId,
        };
        res.writeHead(301, {Location: urlModule.format(logoutUrl)});
        res.end();
    }

    server.use(function (req, res, next) {
        let {url} = req;

        function isCallbackPhaseActive() {
            const redirectUrlObj = new urlModule.URL(oauthConfig.client.redirectPath);
            const redirectPath = oauthConfig.client.redirectPath.slice(redirectUrlObj.origin.length);
            return !!url.includes(redirectPath) || !!url.includes("code=");
        }

        function isPostLogoutPhaseActive() {
            const postLogoutRedirectUrlObj = new urlModule.URL(oauthConfig.client.postLogoutRedirectUrl);
            const postLogoutRedirectPath = oauthConfig.client.postLogoutRedirectUrl.slice(postLogoutRedirectUrlObj.origin.length);
            return !!url.includes(postLogoutRedirectPath);
        }

        function isLogoutPhaseActive() {
            return url === "/logout";
        }

        const canSkipOAuth = urlsToSkip.some((urlToSkip) => url.indexOf(urlToSkip) === 0);
        if (canSkipOAuth) {
            next();
            return;
        }

        if (!config.getConfig("enableLocalhostAuthorization") && req.headers.host.indexOf("localhost") === 0) {
            next();
            return;
        }

        if (isCallbackPhaseActive()) {
            return loginCallbackRoute(req, res);
        }

        if (isLogoutPhaseActive()) {
            return logout(res);
        }

        if (isPostLogoutPhaseActive()) {
            return startAuthFlow(req, res);
        }

        let {accessTokenCookie, refreshTokenCookie, isActiveSession} = util.parseCookies(req.headers.cookie);

        if (!accessTokenCookie) {
            if (!isActiveSession) {
                return startAuthFlow(req, res);
            } else {
                return logout(res);
            }
        }

        const jwksEndpoint = config.getConfig("oauthJWKSEndpoint");
        util.validateEncryptedAccessToken(CURRENT_PRIVATE_KEY_PATH, jwksEndpoint, accessTokenCookie, oauthConfig.sessionTimeout, (err) => {
            if (err) {
                if (err.message === errorMessages.ACCESS_TOKEN_DECRYPTION_FAILED || err.message === errorMessages.SESSION_EXPIRED) {
                    return logout(res);
                }

                return webClient.refreshToken(CURRENT_PRIVATE_KEY_PATH, refreshTokenCookie, (err, tokenSet) => {
                    if (err) {
                        return sendUnauthorizedResponse(req, res, "Unable to refresh token");
                    }

                    const cookies = [`accessTokenCookie=${tokenSet.encryptedAccessToken}; Max-Age=${oauthConfig.sessionTimeout / 1000}`, `refreshTokenCookie=${tokenSet.encryptedRefreshToken}; Max-Age=${oauthConfig.sessionTimeout / 1000}`];
                    res.writeHead(301, {Location: "/", "Set-Cookie": cookies});
                    res.end();
                })
            }

            next();
        })
    });
}

module.exports = OAuthMiddleware;