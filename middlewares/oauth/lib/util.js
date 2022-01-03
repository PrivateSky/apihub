const openDSU = require("opendsu");
const crypto = openDSU.loadAPI("crypto");
const http = openDSU.loadAPI("http");
const fs = require("fs");
const errorMessages = require("./errorMessages");
let currentEncryptionKey;
let previousEncryptionKey;
let publicKey;

function pkce() {
    const codeVerifier = crypto.generateRandom(32).toString('hex');
    const codeChallenge = pkceChallenge(codeVerifier);
    return {codeVerifier, codeChallenge};
}

function pkceChallenge(codeVerifier) {
    return crypto.sha256JOSE(codeVerifier).toString("base64").replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}

function urlEncodeForm(obj) {
    let encodedStr = "";
    for (let prop in obj) {
        encodedStr += `${encodeURIComponent(prop)}=${encodeURIComponent(obj[prop])}&`;
    }
    if (encodedStr[encodedStr.length - 1] === "&") {
        encodedStr = encodedStr.slice(0, -1);
    }

    return encodedStr;
}

function encodeCookie(cookie) {
    if (typeof cookie === "string") {
        cookie = $$.Buffer.from(cookie);
    }
    return encodeURIComponent(cookie.toString("base64"));
}

function decodeCookie(cookie) {
    return $$.Buffer.from(decodeURIComponent(cookie), "base64");
}

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
        let cookieValue = cookieComponents[1].trim();
        if (cookieValue === "null") {
            cookieValue = undefined;
        }
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

function getEncryptionKey(encryptionKeyPath, callback) {
    fs.readFile(encryptionKeyPath, (err, _encKey) => {
        if (err) {
            _encKey = crypto.generateRandom(32);
            fs.writeFile(encryptionKeyPath, _encKey, (err) => callback(undefined, _encKey));
            return
        }

        callback(undefined, _encKey);
    });
}

function getCurrentEncryptionKey(currentEncryptionKeyPath, callback) {
    if (currentEncryptionKey) {
        return callback(undefined, currentEncryptionKey);
    }

    getEncryptionKey(currentEncryptionKeyPath, (err, _currentEncryptionKey)=>{
        if (err) {
            return callback(err);
        }

        currentEncryptionKey = _currentEncryptionKey;
        callback(undefined, currentEncryptionKey);
    });
}

function getPreviousEncryptionKey(previousEncryptionKeyPath, callback) {
    if (previousEncryptionKey) {
        return callback(undefined, previousEncryptionKey);
    }

    getEncryptionKey(previousEncryptionKeyPath, (err, _previousEncryptionKey)=>{
        if (err) {
            return callback(err);
        }

        previousEncryptionKey = _previousEncryptionKey;
        callback(undefined, previousEncryptionKey);
    });
}

function rotateKey(currentEncryptionKeyPath, previousEncryptionKeyPath, callback) {
    // fs.copyFile(currentEncryptionKeyPath, previousEncryptionKeyPath, (err) => {
    fs.readFile(currentEncryptionKeyPath, (err, currentEncryptionKey) => {
        let newEncryptionKey = crypto.generateRandom(32);
        currentEncryptionKey = newEncryptionKey;
        if (err) {
            return fs.writeFile(currentEncryptionKeyPath, newEncryptionKey, callback);
        }

        fs.writeFile(previousEncryptionKeyPath, currentEncryptionKey, (err)=>{
            if (err) {
                return callback(err);
            }

            fs.writeFile(currentEncryptionKeyPath, newEncryptionKey, callback);
        });
    })
}

function encryptTokenSet(currentEncryptionKeyPath, tokenSet, callback) {
    const accessTokenTimestamp = Date.now();
    const accessTokenPayload = {
        date: accessTokenTimestamp,
        token: tokenSet.access_token
    }

    getCurrentEncryptionKey(currentEncryptionKeyPath, (err, encryptionKey) => {
        if (err) {
            return callback(err);
        }

        let encryptedTokenSet;
        try {
            let encryptedAccessToken = crypto.encrypt(JSON.stringify(accessTokenPayload), encryptionKey);
            let encryptedRefreshToken = crypto.encrypt(tokenSet.refresh_token, encryptionKey);
            encryptedTokenSet = {
                encryptedAccessToken: encodeCookie(encryptedAccessToken),
                encryptedRefreshToken: encodeCookie(encryptedRefreshToken)
            }
        } catch (e) {
            return callback(e);
        }
        callback(undefined, encryptedTokenSet);
    })
}

function encryptLoginInfo(currentEncryptionKeyPath, loginInfo, callback) {
    getCurrentEncryptionKey(currentEncryptionKeyPath, (err, encryptionKey) => {
        if (err) {
            return callback(err);
        }

        let encryptedContext;
        try {
            encryptedContext = crypto.encrypt(JSON.stringify(loginInfo), encryptionKey);
            encryptedContext = encodeCookie(encryptedContext);
        } catch (e) {
            return callback(e);
        }
        callback(undefined, encryptedContext);
    })
}

function encryptAccessToken(currentEncryptionKeyPath, accessToken, callback) {
    const accessTokenTimestamp = Date.now();
    const accessTokenPayload = {
        date: accessTokenTimestamp,
        token: accessToken
    }

    getCurrentEncryptionKey(currentEncryptionKeyPath, (err, currentEncryptionKey) => {
        if (err) {
            return callback(err);
        }

        let encryptedAccessToken;
        try {
            encryptedAccessToken = crypto.encrypt(JSON.stringify(accessTokenPayload), currentEncryptionKey);
            encryptedAccessToken = encodeCookie(encryptedAccessToken);
        } catch (e) {
            return callback(e);
        }
        callback(undefined, encryptedAccessToken);
    });
}

function decryptData(encryptedData, encryptionKey, callback) {
     let plainData;
        try {
            plainData = crypto.decrypt(encryptedData, currentEncryptionKey);
        } catch (e) {
            return callback(e);
        }

        callback(undefined, plainData);
}

function decryptDataWithCurrentKey(encryptionKeyPath, encryptedData, callback) {
    getCurrentEncryptionKey(encryptionKeyPath, (err, currentEncryptionKey) => {
        if (err) {
            return callback(err);
        }

        decryptData(encryptedData, currentEncryptionKey, callback);
    })
}

function decryptDataWithPreviousKey(encryptionKeyPath, encryptedData, callback) {
    getPreviousEncryptionKey(encryptionKeyPath, (err, previousEncryptionKey) => {
        if (err) {
            return callback(err);
        }

        decryptData(encryptedData, previousEncryptionKey, callback);
    })
}

function decryptAccessTokenCookie(currentEncryptionKeyPath, previousEncryptionKeyPath, accessTokenCookie, callback) {
    function parseAccessTokenCookie(accessTokenCookie, callback) {
        let parsedAccessTokenCookie;
        try {
            parsedAccessTokenCookie = JSON.parse(accessTokenCookie.toString());
        } catch (e) {
            return callback(e);
        }

        callback(undefined, parsedAccessTokenCookie);
    }

    decryptDataWithCurrentKey(currentEncryptionKeyPath, decodeCookie(accessTokenCookie), (err, plainAccessTokenCookie) => {
        if (err) {
            decryptDataWithPreviousKey(previousEncryptionKeyPath, decodeCookie(accessTokenCookie), (err, plainAccessTokenCookie) => {
                if (err) {
                    return callback(err);
                }

                parseAccessTokenCookie(plainAccessTokenCookie, callback);
            })

            return;
        }


        parseAccessTokenCookie(plainAccessTokenCookie, callback);
    })
}

function decryptRefreshTokenCookie(currentEncryptionKeyPath, previousEncryptionKeyPath, encryptedRefreshToken, callback) {
    decryptDataWithCurrentKey(currentEncryptionKeyPath, encryptedRefreshToken, (err, refreshToken) => {
        if (err) {
            decryptDataWithPreviousKey(previousEncryptionKeyPath, encryptedRefreshToken, (err, refreshToken) => {
                if (err) {
                    return callback(err);
                }

                callback(undefined, refreshToken.toString());
            });
            return
        }

        callback(undefined, refreshToken.toString());
    })
}

function getPublicKey(jwksEndpoint, rawAccessToken, callback) {
    if (publicKey) {
        return callback(undefined, publicKey);
    }

    http.doGet(jwksEndpoint, (err, rawData) => {
        if (err) {
            return callback(err);
        }
        try {
            const parsedData = JSON.parse(rawData);
            const accessToken = parseAccessToken(rawAccessToken);
            publicKey = parsedData.keys.find(key => key.use === "sig" && key.kid === accessToken.header.kid);
        } catch (e) {
            callback(e);
        }

        callback(undefined, publicKey);
    })
}

function validateAccessToken(jwksEndpoint, accessToken, callback) {
    getPublicKey(jwksEndpoint, accessToken, (err, publicKey) => {
        if (err) {
            return callback(err);
        }

        crypto.joseAPI.verify(accessToken, publicKey, callback);
    })
}

function validateEncryptedAccessToken(currentEncryptionKeyPath, previousEncryptionKeyPath, jwksEndpoint, accessTokenCookie, sessionTimeout, callback) {
    decryptAccessTokenCookie(currentEncryptionKeyPath, previousEncryptionKeyPath, accessTokenCookie, (err, decryptedAccessTokenCookie) => {
        if (err) {
            return callback(Error(errorMessages.ACCESS_TOKEN_DECRYPTION_FAILED));
        }

        if (Date.now() - decryptedAccessTokenCookie.date > sessionTimeout) {
            return callback(Error(errorMessages.SESSION_EXPIRED));
        }
        validateAccessToken(jwksEndpoint, decryptedAccessTokenCookie.token, callback);
    })
}

function decryptLoginInfo(currentEncryptionKeyPath, previousEncryptionKeyPath,  encryptedLoginInfo, callback) {
    decryptDataWithCurrentKey(currentEncryptionKeyPath, decodeCookie(encryptedLoginInfo), (err, loginContext)=>{
        function parseLoginContext(loginContext, callback) {
            let parsedLoginContext;
            try {
                parsedLoginContext = JSON.parse(loginContext.toString());
            } catch (e) {
                return callback(e);
            }

            callback(undefined, parsedLoginContext);
        }

        if (err) {
            decryptDataWithPreviousKey(previousEncryptionKeyPath, decodeCookie(encryptedLoginInfo), (err, loginContext)=>{
                if (err) {
                    return callback(err);
                }

                parseLoginContext(loginContext, callback);
            })

            return;
        }

        parseLoginContext(loginContext, callback);
    })
}

function getUrlsToSkip() {
    const config = require("../../../config");
    const skipOAuth = config.getConfig("skipOAuth");
    let urlsToSkip = skipOAuth && Array.isArray(skipOAuth) ? skipOAuth : [];
    const configuredDomains = config.getConfiguredDomains();
    configuredDomains.forEach(domain => {
        const domainConfig = config.getDomainConfig(domain);
        if (domainConfig.skipOAuth) {
            urlsToSkip = urlsToSkip.concat(domainConfig.skipOAuth);
        }
    })

    return urlsToSkip;
}

module.exports = {
    pkce,
    pkceChallenge,
    urlEncodeForm,
    encodeCookie,
    decodeCookie,
    parseCookies,
    getEncryptionKey,
    parseAccessToken,
    encryptTokenSet,
    encryptAccessToken,
    encryptLoginInfo,
    decryptLoginInfo,
    decryptAccessTokenCookie,
    decryptRefreshTokenCookie,
    getPublicKey,
    validateAccessToken,
    validateEncryptedAccessToken,
    getUrlsToSkip,
    rotateKey
}
