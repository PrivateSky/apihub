const openDSU = require("opendsu");
const crypto = openDSU.loadAPI("crypto");
const http = openDSU.loadAPI("http");
const {sendUnauthorizedResponse} = require("../../utils/middlewares");
const config = require("../../config");
const url = require("url");
const util = require("./util");

function OAuth(server) {
    console.log(`Registering OAuth middleware`);

    const fs = require("fs");
    const path = require("path");
    console.log("=====================================================================================================")
    console.log(server.rootFolder);
    console.log(require("os").hostname())
    console.log(Object.keys(server));
    console.log("=====================================================================================================")
    const CURRENT_PRIVATE_KEY_PATH = path.join(server.rootFolder, "currentPrivateKey");
    const config = require("../../config");
    const skipOAuth = config.getConfig("skipOAuth");
    const urlsToSkip = skipOAuth && Array.isArray(skipOAuth) ? skipOAuth : [];
    const oauthConfig = config.getConfig("oauthConfig");
    let clientCode;
    let publicKey;
    let encryptionKey;

    function parseCookies(cookies) {
        const parsedCookies = {};
        if (!cookies) {
            return parsedCookies;
        }
        let splitCookies = cookies.split(";");
        splitCookies = splitCookies.map(splitCookie => splitCookie.trim());
        splitCookies.forEach(cookie => {
            const cookieComponents = cookie.split("=");
            const cookieName = cookieComponents[0].trim();
            const cookieValue = cookieComponents[1].trim();
            parsedCookies[cookieName] = cookieValue;
        })

        return parsedCookies;
    }

    function parseAccessToken(rawAccessToken) {
        let [header, payload, signature] = rawAccessToken.split(".");
        header = JSON.parse($$.Buffer.from(header, "base64").toString())
        payload = JSON.parse($$.Buffer.from(payload, "base64").toString())
        return {
            header, payload, signature
        }
    }

    function getEncryptionKey(callback) {
        if(encryptionKey){
            return callback(undefined, encryptionKey);
        }
        fs.readFile(CURRENT_PRIVATE_KEY_PATH, (err, _encKey)=>{
            if (err) {
                encryptionKey = util.randomBytes(32);
                fs.writeFile(CURRENT_PRIVATE_KEY_PATH, encryptionKey, (err) => callback(undefined, encryptionKey));
                return
            }

            encryptionKey = _encKey;
            callback(undefined, encryptionKey);
        });
    }

    function getLoginContext(oauthConfig) {
        const fingerprint = util.randomBytes(32).toString('hex');
        const state = util.randomBytes(32).toString('hex');
        const pkce = util.pkce();
        const URL = url.URL;
        const authorizeUrl = url.parse(oauthConfig.issuer.authorizationEndpoint);
        authorizeUrl.query = {
            client_id: oauthConfig.client.clientId,
            redirect_uri: oauthConfig.client.redirectPath,
            response_type: 'code',
            scope: oauthConfig.client.scope,
            code_challenge_method: 'S256',
            code_challenge: pkce.codeChallenge,
            state
        };
        return {
            state,
            fingerprint,
            codeVerifier: pkce.codeVerifier,
            redirect: url.format(authorizeUrl)
        }
    }

    function startAuthFlow(req, res, next) {
        const loginContext = getLoginContext(oauthConfig);

        // req.session.state = loginContext.state;
        // req.session.fingerprint = loginContext.fingerprint;
        // req.session.codeVerifier = loginContext.codeVerifier;
        // req.session.save(function () {
        //     res.redirect(loginContext.redirect);
        //     next();
        // });

        getEncryptionKey((err, currentEncryptionKey) => {
            if (err) {
                return sendUnauthorizedResponse(req, res, "Unable to get encryption key");
            }

            let encryptedContext;
            try {
                encryptedContext = crypto.encrypt(JSON.stringify(loginContext), currentEncryptionKey);
            } catch (e) {
                return sendUnauthorizedResponse(req, res, "Unable to encrypt context");
            }

            res.writeHead(301, {
                Location: loginContext.redirect,
                "Set-Cookie": `loginContextCookie=${encryptedContext.toString("hex")}`
            });
            res.end();
        })
    }

    function refreshToken(oauthConfig, refreshTokenCookie, callback) {
        getEncryptionKey((err, currentEncryptionKey) => {
            if (err) {
                return callback(err);
            }

            let refreshToken;
            try {
                refreshToken = crypto.decrypt(refreshTokenCookie, currentEncryptionKey);
            } catch (e) {
                return callback(e);
            }
            // const params = new URLSearchParams();
            // params.append('grant_type', 'refresh_token');
            // params.append('client_id', oauthConfig.client.clientId);
            // params.append('redirect_uri', oauthConfig.client.redirectUri);
            // params.append('refresh_token', refreshToken);
            // params.append('client_secret', oauthConfig.client.clientSecret);

            const body = {
                'grant_type': 'refresh_token',
                'client_id': oauthConfig.client.clientId,
                'redirect_uri': oauthConfig.client.redirectPath,
                'refresh_token': refreshToken,
                'client_secret': oauthConfig.client.clientSecret
            }
            const options = {
                method: 'POST',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            }

            const http = openDSU.loadAPI("http");
            http.doPost(oauthConfig.issuer.tokenEndpoint, urlEncodeForm(body), options, (err, tokenSet)=>{
                if (err) {
                    return callback(err);
                }

                try{
                    tokenSet = JSON.parse(tokenSet);
                }catch (e) {
                    return callback(err);
                }

                const accessTokenTimestamp = Date.now();
                const accessTokenPayload = {
                    date: accessTokenTimestamp,
                    token: tokenSet.access_token
                }


                let encryptedAccessToken;
                try {
                    encryptedAccessToken = crypto.encrypt(JSON.stringify(accessTokenPayload), currentEncryptionKey);
                } catch (e) {
                    return callback(e);
                }

                let encryptedRefreshToken;
                try {
                    encryptedRefreshToken = crypto.encrypt(tokenSet.refresh_token, currentEncryptionKey);
                } catch (e) {
                    return callback(e);
                }

                const encryptedTokenSet = {
                    encryptedAccessToken: encodeURIComponent(encryptedAccessToken.toString("base64")),
                    encryptedRefreshToken: encodeURIComponent(encryptedRefreshToken.toString("base64"))
                }
                callback(undefined, encryptedTokenSet);
            })
        })
    }

    function getPublicKey(rawAccessToken, callback) {
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
                try {
                    const parsedData = JSON.parse(rawData);
                    const accessToken = parseAccessToken(rawAccessToken);
                    publicKey = parsedData.keys.find(key => key.use === "sig" && key.kid === accessToken.header.kid);
                    callback(undefined, publicKey);
                } catch (e) {
                    console.error(e.message);
                }
            });
        });
    }

    function decryptAccessTokenCookie(accessTokenCookie, callback) {
        getEncryptionKey((err, currentEncryptionKey) => {
            if (err) {
                return callback(err);
            }

            let plainAccessTokenCookie;
            try {
                plainAccessTokenCookie = crypto.decrypt($$.Buffer.from(decodeURIComponent(accessTokenCookie), "base64"), currentEncryptionKey);
            } catch (e) {
                return callback(e);
            }

            try {
                plainAccessTokenCookie = JSON.parse(plainAccessTokenCookie.toString());
            } catch (e) {
                return callback(e);
            }

            callback(undefined, plainAccessTokenCookie);
        })
    }

    function urlEncodeForm(obj) {
        let encodedStr = "";
        for(let prop in obj) {
            encodedStr += `${encodeURIComponent(prop)}=${encodeURIComponent(obj[prop])}&`;
        }
        if(encodedStr[encodedStr.length-1] === "&"){
            encodedStr = encodedStr.slice(0, -1);
        }

        return encodedStr;
    }

    function validateAccessToken(accessToken, callback) {
        getPublicKey(accessToken, (err, publicKey) => {
            if (err) {
                return callback(err);
            }

            crypto.joseAPI.verify(accessToken, publicKey, callback);
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
        let {accessTokenCookie, refreshTokenCookie} = parseCookies(req.headers.cookie);

        if (!accessTokenCookie) {
            return startAuthFlow(req, res, next);
        }

        decryptAccessTokenCookie(accessTokenCookie, (err, decryptedAccessTokenCookie) => {
            if (err) {
                return startAuthFlow(req, res, next);
            }

            if (Date.now() - decryptedAccessTokenCookie.date > oauthConfig.sessionTimeout) {
                return startAuthFlow(req, res, next);
            }

            validateAccessToken(decryptedAccessTokenCookie.token, (err, result) => {
                if (err) {
                    return refreshToken(oauthConfig, refreshTokenCookie, (err, tokenSet) => {
                        if (err) {
                            return startAuthFlow(req, res, next);
                        }

                        const cookie = `accessTokenCookie=${tokenSet.encryptedAccessToken}; refreshTokenCookie=${tokenSet.encryptedRefreshToken}`;
                        // res.setHeader("Set-Cookie", cookie);
                        res.writeHead(301, {Location: "/", "Set-Cookie": cookie});
                        res.end();
                    })
                }

            })
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

    function loginCallback(context, callback) {
        if (context.clientState !== context.queryState) {
            return callback(new Error('Invalid state'));
        }


        //Content-Type: application/x-www-form-urlencoded
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code')
        params.append('client_id', oauthConfig.client.clientId)
        params.append('client_secret', oauthConfig.client.clientSecret)
        params.append('redirect_uri', oauthConfig.client.redirectPath)
        params.append('code', context.queryCode)
        params.append('code_verifier', context.clientCode)
        //
        let body = {
            'grant_type': 'authorization_code',
            'client_id': oauthConfig.client.clientId,
            // 'client_secret': oauthConfig.client.clientSecret,
            'redirect_uri': oauthConfig.client.redirectPath,
            'code': context.queryCode,
            'code_verifier': context.clientCode
        }

        // const http = require('https');

        const postData = urlEncodeForm(body);

        const options = {
            method:"POST",
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': postData.length,
                'Origin':'http://localhost'
            }
        };

        // const req = http.request(oauthConfig.issuer.tokenEndpoint, options, (res) => {
        //     console.log(`STATUS: ${res.statusCode}`);
        //     console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
        //     res.setEncoding('utf8');
        //     res.on('data', (chunk) => {
        //         console.log(`BODY: ${chunk}`);
        //     });
        //     res.on('end', () => {
        //         console.log('No more data in response.');
        //     });
        // });
        //
        // req.on('error', (e) => {
        //     console.error(`problem with request: ${e.message}`);
        // });

// Write data to request body
//         req.write(postData);
//         req.end();
        http.doPost(oauthConfig.issuer.tokenEndpoint, urlEncodeForm(body), options, (err, tokenSet)=>{
            if (err) {
                return callback(err);
            }

            try{
                tokenSet = JSON.parse(tokenSet);
            }catch (e) {
                return callback(e);
            }

            callback(undefined, tokenSet);
        });
    }

    function loginCallbackRoute(req, res, next) {
        let cbUrl = req.url;
        let query = url.parse(cbUrl, true).query;
        let loginContext;

        // const clientState = req.session.state;
        // const clientFingerprint = req.session.fingerprint;
        // const clientCode = req.session.codeVerifier;
        const {loginContextCookie} = parseCookies(req.headers.cookie);
        getEncryptionKey((err, currentEncryptionKey)=>{
            if (err) {
                return sendUnauthorizedResponse(req, res, "Unable to get encryption key");
            }
            let loginContext;
            try{
                loginContext = crypto.decrypt($$.Buffer.from(loginContextCookie, "hex"), currentEncryptionKey);
                loginContext = JSON.parse(loginContext.toString());
            }catch (e) {
                return sendUnauthorizedResponse(req, res, "Failed to validate login context");
            }


            const queryCode = query['code'];
            const queryState = query['state'];


            loginCallback({
                clientState: loginContext.state,
                clientFingerprint:loginContext.fingerprint,
                clientCode:loginContext.codeVerifier,
                queryCode,
                queryState
            }, (err, tokenSet) => {
                if (err) {
                    return next(err);
                }
                const accessTokenTimestamp = Date.now();
                const accessTokenPayload = {
                    date: accessTokenTimestamp,
                    token: tokenSet.access_token
                }


                getEncryptionKey((err, currentEncryptionKey) => {
                    if (err) {
                        return sendUnauthorizedResponse(req, res, "Unable to get encryption key");
                    }

                    let encryptedAccessToken;
                    try {
                        encryptedAccessToken = crypto.encrypt(JSON.stringify(accessTokenPayload), currentEncryptionKey);
                    } catch (e) {
                        return callback(e);
                    }

                    res.writeHead(301, {Location: "/", "Set-Cookie": `accessTokenCookie=${encodeURIComponent(encryptedAccessToken.toString("base64"))}`});
                    res.end();
                })
            });
        })

    }

    // server.get("/?root=true", loginCallbackRoute);
}


module.exports = require("./OauthMiddleware");

