const openDSU = require("opendsu");
const crypto = openDSU.loadAPI("crypto");
const http = openDSU.loadAPI("http");
const fs = require("fs");
const {sendUnauthorizedResponse} = require("../../../utils/middlewares");
const config = require("../../../config");
const errorMessages = require("./errorMessages");
let encryptionKey;
let publicKey;

function pkce() {
    const codeVerifier = crypto.generateRandom(32).toString('hex');
    const codeChallenge = pkceChallenge(codeVerifier);
    return {codeVerifier, codeChallenge};
}


function pkceChallenge(codeVerifier) {
    return crypto.sha256JOSE(codeVerifier, 'base64url');
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

function getEncryptionKey(encryptionKeyPath, callback) {
    if (encryptionKey) {
        return callback(undefined, encryptionKey);
    }
    fs.readFile(encryptionKeyPath, (err, _encKey) => {
        if (err) {
            _encKey = crypto.generateRandom(32);
            encryptionKey = _encKey;
            fs.writeFile(encryptionKeyPath, _encKey, (err) => callback(undefined, _encKey));
            return
        }

        encryptionKey = _encKey;
        callback(undefined, encryptionKey);
    });
}

function encryptTokenSet(encryptionKeyPath, tokenSet, callback) {
    const accessTokenTimestamp = Date.now();
    const accessTokenPayload = {
        date: accessTokenTimestamp,
        token: tokenSet.access_token
    }

    getEncryptionKey(encryptionKeyPath, (err, encryptionKey) => {
        if (err) {
            return callback(err);
        }

        let encryptedTokenSet;
        try {
            let encryptedAccessToken = crypto.encrypt(JSON.stringify(accessTokenPayload), encryptionKey);
            let encryptedRefreshToken = crypto.encrypt(tokenSet.refresh_token, encryptionKey);
            const encryptedTokenSet = {
                encryptedAccessToken: encodeCookie(encryptedAccessToken),
                encryptedRefreshToken: encodeCookie(encryptedRefreshToken)
            }
        } catch (e) {
            return callback(e);
        }
        callback(undefined, encryptedTokenSet);
    })
}

function encryptLoginInfo(encryptionKeyPath, loginInfo, callback) {
    getEncryptionKey(encryptionKeyPath, (err, encryptionKey) => {
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

function encryptAccessToken(encryptionKeyPath, accessToken, callback) {
    const accessTokenTimestamp = Date.now();
    const accessTokenPayload = {
        date: accessTokenTimestamp,
        token: accessToken
    }

    getEncryptionKey(encryptionKeyPath, (err, currentEncryptionKey) => {
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

function decryptAccessTokenCookie(encryptionKeyPath, accessTokenCookie, callback) {
    getEncryptionKey(encryptionKeyPath, (err, currentEncryptionKey) => {
        if (err) {
            return callback(err);
        }

        let plainAccessTokenCookie;
        try {
            plainAccessTokenCookie = crypto.decrypt(decodeCookie(accessTokenCookie), currentEncryptionKey);
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

function decryptRefreshTokenCookie(encryptionKeyPath, encryptedRefreshToken, callback) {
    getEncryptionKey(encryptionKeyPath, (err, currentEncryptionKey) => {
        if (err) {
            return callback(err);
        }

        let refreshToken;
        try {
            refreshToken = crypto.decrypt(encryptedRefreshToken, currentEncryptionKey);
        } catch (e) {
            return callback(e);
        }
        callback(undefined, refreshToken);
    });
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

function validateEncryptedAccessToken(encryptionKeyPath, jwksEndpoint, accessTokenCookie, sessionTimeout, callback) {
    decryptAccessTokenCookie(encryptionKeyPath, accessTokenCookie, (err, decryptedAccessTokenCookie) => {
        if (err) {
            return callback(Error(errorMessages.ACCESS_TOKEN_DECRYPTION_FAILED));
        }

        if (Date.now() - decryptedAccessTokenCookie.date > sessionTimeout) {
            return callback(Error(errorMessages.SESSION_EXPIRED));
        }
        validateAccessToken(jwksEndpoint, decryptedAccessTokenCookie.token, callback);
    })
}

function decryptLoginInfo(encryptionKeyPath, encryptedLoginInfo, callback) {
    getEncryptionKey(encryptionKeyPath,(err, currentEncryptionKey) => {
        if (err) {
            return callback(err);
        }

        let loginContext;
        try {
            loginContext = crypto.decrypt(decodeCookie(encryptedLoginInfo), currentEncryptionKey);
            loginContext = JSON.parse(loginContext.toString());
        } catch (e) {
            return callback(e);
        }
        callback(undefined, loginContext);
    });
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
    validateEncryptedAccessToken
}