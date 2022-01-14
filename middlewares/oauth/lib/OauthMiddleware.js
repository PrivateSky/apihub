const {sendUnauthorizedResponse} = require("../../../utils/middlewares");
const util = require("./util");
const urlModule = require("url");

function OAuthMiddleware(server) {
    console.log(`Registering OAuthMiddleware`);

    const path = require("path");
    const PREVIOUS_ENCRYPTION_KEY_PATH = path.join(server.rootFolder, "previousEncryptionKey.secret");
    const CURRENT_ENCRYPTION_KEY_PATH = path.join(server.rootFolder, "currentEncryptionKey.secret");
    const urlsToSkip = util.getUrlsToSkip();
    const config = require("../../../config");
    const oauthConfig = config.getConfig("oauthConfig");
    const WebClient = require("./WebClient");
    const webClient = new WebClient(oauthConfig);
    const errorMessages = require("./errorMessages");

    setInterval(() => {
        util.rotateKey(CURRENT_ENCRYPTION_KEY_PATH, PREVIOUS_ENCRYPTION_KEY_PATH, () => {})
    }, oauthConfig.keyTTL);

    function startAuthFlow(req, res) {
        const loginContext = webClient.getLoginInfo(oauthConfig);
        util.encryptLoginInfo(CURRENT_ENCRYPTION_KEY_PATH, loginContext, (err, encryptedContext) => {
            if (err) {
                return sendUnauthorizedResponse(req, res, "Unable to encrypt login info");
            }

            res.writeHead(301, {
                Location: loginContext.redirect,
                "Set-Cookie": `loginContextCookie=${encryptedContext}`,
                "Cache-Control": "no-store, no-cache, must-revalidate, post-check=0, pre-check=0"
            });
            res.end();
        })
    }

    function loginCallbackRoute(req, res) {
        let cbUrl = req.url;
        let query = urlModule.parse(cbUrl, true).query;
        const {loginContextCookie} = util.parseCookies(req.headers.cookie);
        if (!loginContextCookie) {
            debugMessage("Logout because loginContextCookie is missing.")
            return logout(res);
        }
        util.decryptLoginInfo(CURRENT_ENCRYPTION_KEY_PATH, PREVIOUS_ENCRYPTION_KEY_PATH, loginContextCookie, (err, loginContext) => {
            if (err) {
                return sendUnauthorizedResponse(req, res, "Unable to decrypt login info");
            }

            if (Date.now() - loginContext.date > oauthConfig.sessionTimeout) {
                debugMessage("Logout because loginContextCookie is expired.")
                return logout(res);
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

                util.encryptTokenSet(CURRENT_ENCRYPTION_KEY_PATH, tokenSet, (err, encryptedTokenSet) => {
                    if (err) {
                        return sendUnauthorizedResponse(req, res, "Unable to encrypt access token");
                    }

                    res.writeHead(301, {
                        Location: "/",
                        "Set-Cookie": [`accessTokenCookie=${encryptedTokenSet.encryptedAccessToken}; Max-Age=${oauthConfig.sessionTimeout / 1000}`, "isActiveSession=true", `refreshTokenCookie=${encryptedTokenSet.encryptedRefreshToken}; Max-Age=${oauthConfig.sessionTimeout / 1000}`, `loginContextCookie=; Max-Age=0`],
                        "Cache-Control": "no-store, no-cache, must-revalidate, post-check=0, pre-check=0"
                    });
                    res.end();
                })
            });
        });
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

    function debugMessage(...args) {
        if (oauthConfig.debugLogEnabled) {
            console.log(...args);
        }
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
                debugMessage("Redirect to start authentication flow because accessTokenCookie and isActiveSession are missing.")
                return startAuthFlow(req, res);
            } else {
                debugMessage("Logout because accessTokenCookie is missing and isActiveSession is present.")
                return logout(res);
            }
        }

        const jwksEndpoint = config.getConfig("oauthJWKSEndpoint");
        util.validateEncryptedAccessToken(CURRENT_ENCRYPTION_KEY_PATH, PREVIOUS_ENCRYPTION_KEY_PATH, jwksEndpoint, accessTokenCookie, oauthConfig.sessionTimeout, (err) => {
            if (err) {
                if (err.message === errorMessages.ACCESS_TOKEN_DECRYPTION_FAILED || err.message === errorMessages.SESSION_EXPIRED) {
                    debugMessage("Logout because accessTokenCookie decryption failed or session has expired.")
                    return logout(res);
                }

                return webClient.refreshToken(CURRENT_ENCRYPTION_KEY_PATH, PREVIOUS_ENCRYPTION_KEY_PATH, refreshTokenCookie, (err, tokenSet) => {
                    if (err) {
                        if (err.message === errorMessages.REFRESH_TOKEN_DECRYPTION_FAILED || err.message === errorMessages.SESSION_EXPIRED) {
                            debugMessage("Logout because refreshTokenCookie decryption failed or session has expired.")
                            return logout(res);
                        }
                        return sendUnauthorizedResponse(req, res, "Unable to refresh token");
                    }

                    const cookies = [`accessTokenCookie=${tokenSet.encryptedAccessToken}`, `refreshTokenCookie=${tokenSet.encryptedRefreshToken}`];
                    res.writeHead(301, {Location: "/", "Set-Cookie": cookies});
                    res.end();
                })
            }

            next();
        })
    });
}

module.exports = OAuthMiddleware;