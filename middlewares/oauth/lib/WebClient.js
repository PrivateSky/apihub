const url = require('url');
const util = require("./util");
const openDSU = require("opendsu");
const http = openDSU.loadAPI("http");
const crypto = openDSU.loadAPI("crypto");
const errorMessages = require("./errorMessages");

function WebClient(oauthConfig) {
    this.getLoginInfo = () => {
        const fingerprint = crypto.generateRandom(32).toString('hex');//User-agent IP
        const state = crypto.generateRandom(32).toString('hex');
        const pkce = util.pkce();
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
            redirect: url.format(authorizeUrl),
            date: Date.now()
        }
    }


    this.loginCallback = (context, callback) => {
        //fingerprint virification
        if (context.clientState !== context.queryState) {
            return callback(new Error('Invalid state'));
        }

        let body = {
            'grant_type': 'authorization_code',
            'client_id': oauthConfig.client.clientId,
            'client_secret': oauthConfig.client.clientSecret,
            'redirect_uri': oauthConfig.client.redirectPath,
            'code': context.queryCode,
            'code_verifier': context.clientCode
        }

        const postData = util.urlEncodeForm(body);

        const options = {
            method: "POST",
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': postData.length
            }
        };

        http.doPost(oauthConfig.issuer.tokenEndpoint, util.urlEncodeForm(body), options, (err, tokenSet) => {
            if (err) {
                return callback(err);
            }

            try {
                tokenSet = JSON.parse(tokenSet);
            } catch (e) {
                return callback(e);
            }

            callback(undefined, tokenSet);
        });
    }

    this.refreshToken = function refreshToken(currentEncryptionKeyPath, previousEncryptionKeyPath, refreshTokenCookie, callback) {
        util.decryptRefreshTokenCookie(currentEncryptionKeyPath, previousEncryptionKeyPath, refreshTokenCookie, (err, refreshToken) => {
            if (err) {
                return callback(err);
            }

            if ( Date.now() - refreshToken.date > oauthConfig.sessionTimeout) {
                return callback(Error(errorMessages.SESSION_EXPIRED))
            }

            const body = {
                'grant_type': 'refresh_token',
                'client_id': oauthConfig.client.clientId,
                'redirect_uri': oauthConfig.client.redirectPath,
                'refresh_token': refreshToken,
                'client_secret': oauthConfig.client.clientSecret
            };
            const postData = util.urlEncodeForm(body);
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData)
                }
            }

            http.doPost(oauthConfig.issuer.tokenEndpoint, postData, options, (err, tokenSet) => {
                if (err) {
                    return callback(err);
                }

                try {
                    tokenSet = JSON.parse(tokenSet);
                } catch (e) {
                    return callback(e);
                }
                util.encryptTokenSet(currentEncryptionKeyPath, tokenSet, callback);
            });
        });
    }
}


module.exports = WebClient;