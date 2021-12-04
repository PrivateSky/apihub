const openDSU = require("opendsu");
const crypto = openDSU.loadAPI("crypto");
const http = openDSU.loadAPI("http");
const {sendUnauthorizedResponse} = require("../../utils/middlewares");
const config = require("../../config");
const url = require("url");
const util = require("./util");

function OAuthMiddleware(server) {
    console.log(`Registering OAuth middleware`);

    const path = require("path");
    const CURRENT_PRIVATE_KEY_PATH = path.join(server.rootFolder, "currentPrivateKey");
    const config = require("../../config");
    const skipOAuth = config.getConfig("skipOAuth");
    const urlsToSkip = skipOAuth && Array.isArray(skipOAuth) ? skipOAuth : [];
    const oauthConfig = config.getConfig("oauthConfig");
    const WebClient = require("./WebClient");
    const webClient = new WebClient(oauthConfig);
    const errorMessages = require("./errorMessages");

    function startAuthFlow(req, res, next) {
        const loginContext = webClient.getLoginInfo(oauthConfig);
        util.encryptLoginInfo(CURRENT_PRIVATE_KEY_PATH, loginContext, (err, encryptedContext)=>{
            if (err) {
                return sendUnauthorizedResponse(req, res, "Unable to encrypt login info");
            }

            res.writeHead(301, {
                Location: loginContext.redirect,
                "Set-Cookie": `loginContextCookie=${encryptedContext}`
            });
            res.end();
        })
    }

    function loginCallbackRoute(req, res, next) {
        let cbUrl = req.url;
        let query = url.parse(cbUrl, true).query;
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
                queryState
            }, (err, tokenSet) => {
                if (err) {
                    return sendUnauthorizedResponse(req, res, "Unable to get token set");
                }

                util.encryptAccessToken(CURRENT_PRIVATE_KEY_PATH, tokenSet.access_token, (err, encryptedAccessToken) => {
                    if (err) {
                        return sendUnauthorizedResponse(req, res, "Unable to encrypt access token");
                    }

                    res.writeHead(301, {Location: "/", "Set-Cookie": `accessTokenCookie=${encryptedAccessToken}`});
                    res.end();
                })
            });
        })
    }

    server.use(function (req, res, next) {
        let {url} = req;
        const urlModule = require("url");
        const redirectUrlObj = new urlModule.URL(oauthConfig.client.redirectPath);
        const redirectPath = oauthConfig.client.redirectPath.slice(redirectUrlObj.origin.length);

        function isCallbackPhaseActive() {
            return !!url.includes(redirectPath) || !!url.includes("code=");
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
            return loginCallbackRoute(req, res, next);
        }
        let {accessTokenCookie, refreshTokenCookie} = util.parseCookies(req.headers.cookie);

        if (!accessTokenCookie) {
            return startAuthFlow(req, res, next);
        }

        const jwksEndpoint = config.getConfig("oauthJWKSEndpoint");
        util.validateEncryptedAccessToken(CURRENT_PRIVATE_KEY_PATH, jwksEndpoint, accessTokenCookie, oauthConfig.sessionTimeout, (err) => {
            if (err) {
                if (err.message === errorMessages.ACCESS_TOKEN_DECRYPTION_FAILED || err.message === errorMessages.SESSION_EXPIRED) {
                    return startAuthFlow(req, res, next);
                }

                return webClient.refreshToken(CURRENT_PRIVATE_KEY_PATH, refreshTokenCookie, (err, tokenSet)=>{
                    if (err) {
                        return sendUnauthorizedResponse(req, res, "Unable to refresh token");
                    }

                    const cookie = `accessTokenCookie=${tokenSet.encryptedAccessToken}; refreshTokenCookie=${tokenSet.encryptedRefreshToken}`;
                    res.writeHead(301, {Location: "/", "Set-Cookie": cookie});
                    res.end();
                })
            }

            next();
        })

        //     try {
        //
        //         verifyAccessToken(accessToken);
        //     } catch (e) {
        //         try {
        //             refreshToken(refreshTokenCookie);
        //         } catch (e) {
        //             startAuthFlow = true;
        //         }
        //     }
        // })
        // try {
        //
        //     accessToken, sessionExpDate = decryptAccessToken(accessTokenCookie);
        // } catch (e) {
        //     return startAuthFlow(req, res, next);
        // }
        //
        // if (Date.now() - sessionExpDate > 30 * 1000 * 1000) {
        //     return startAuthFlow(req, res, next);
        // }
        //
        // try {
        //
        //     verifyAccessToken(accessToken);
        // } catch (e) {
        //     try {
        //         refreshToken(refreshTokenCookie);
        //     } catch (e) {
        //         startAuthFlow = true;
        //     }
        // }


        // if (!rawAccessToken) {
        //     res.writeHead(301, {Location: "/"});
        //     res.end();
        //     return;
        // }
        //

        // getPublicKey(rawAccessToken, (err, publicKey) => {
        //     if (err) {
        //         return sendUnauthorizedResponse(req, res, "Unable to get JWKS");
        //     }
        //
        //     crypto.joseAPI.verify(rawAccessToken, publicKey, (err) => {
        //         if (err) {
        //             return sendUnauthorizedResponse(req, res, "Failed to validate token");
        //         }
        //
        //         next();
        //     });
        // })
    });
}

module.exports = OAuthMiddleware;