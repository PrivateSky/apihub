const {sendUnauthorizedResponse} = require("../../../utils/middlewares");
const util = require("./util");
const urlModule = require("url");

function OAuthMiddleware(server) {
  const logger = $$.getLogger("OAuthMiddleware", "apihub/oauth");

  logger.info(`Registering OAuthMiddleware`);
  const fs = require("fs");
  const config = require("../../../config");
  const oauthConfig = config.getConfig("oauthConfig");
  const path = require("path");
  const ENCRYPTION_KEYS_LOCATION = oauthConfig.encryptionKeysLocation || path.join(server.rootFolder, "external-volume", "encryption-keys");
  const PREVIOUS_ENCRYPTION_KEY_PATH = path.join(ENCRYPTION_KEYS_LOCATION, "previousEncryptionKey.secret");
  const CURRENT_ENCRYPTION_KEY_PATH = path.join(ENCRYPTION_KEYS_LOCATION, "currentEncryptionKey.secret");
  const urlsToSkip = util.getUrlsToSkip();

  const WebClient = require("./WebClient");
  const webClient = new WebClient(oauthConfig);
  const errorMessages = require("./errorMessages");
  try {
    fs.accessSync(ENCRYPTION_KEYS_LOCATION);
  } catch (e) {
    fs.mkdirSync(ENCRYPTION_KEYS_LOCATION, {recursive: true});
  }
  setInterval(() => {
    util.rotateKey(CURRENT_ENCRYPTION_KEY_PATH, PREVIOUS_ENCRYPTION_KEY_PATH, () => {
    })
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
        return sendUnauthorizedResponse(req, res, "Unable to decrypt login info", err);
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
          return sendUnauthorizedResponse(req, res, "Unable to get token set", err);
        }

        debugMessage("Access token", tokenSet.access_token);
        util.encryptTokenSet(CURRENT_ENCRYPTION_KEY_PATH, tokenSet, (err, encryptedTokenSet) => {
          if (err) {
            return sendUnauthorizedResponse(req, res, "Unable to encrypt access token", err);
          }

          const {payload} = util.parseAccessToken(tokenSet.access_token);
          debugMessage("Access token payload", payload);
          const SSODetectedId = util.getSSODetectedIdFromDecryptedToken(tokenSet.access_token);
          debugMessage("SSODetectedId", SSODetectedId);
          res.writeHead(301, {
            Location: "/",
            "Set-Cookie": [`accessTokenCookie=${encryptedTokenSet.encryptedAccessToken}`, "isActiveSession=true", `refreshTokenCookie=${encryptedTokenSet.encryptedRefreshToken}`, `SSOUserId = ${payload.sub}`, `SSODetectedId = ${SSODetectedId}`, `loginContextCookie=; Max-Age=0`],
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
    res.writeHead(301, {
      Location: urlModule.format(logoutUrl),
      "Set-Cookie": `sessionExpiryTime=; Path=/`
    });
    res.end();
  }


  function debugMessage(...args) {
    if (oauthConfig.debugLogEnabled) {
      logger.info(...args);
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

    function startLogoutPhase(res) {
      res.writeHead(301, {
        Location: "/logout",
        "Set-Cookie": ["accessTokenCookie=; Max-Age=0", "isActiveSession=; Max-Age=0", "refreshTokenCookie=; Max-Age=0", "loginContextCookie=; Max-Age=0"],
        "Cache-Control": "no-store, no-cache, must-revalidate, post-check=0, pre-check=0"
      });
      res.end();
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
        return startLogoutPhase(res);
      }
    }

    const jwksEndpoint = config.getConfig("oauthJWKSEndpoint");
    util.validateEncryptedAccessToken(CURRENT_ENCRYPTION_KEY_PATH, PREVIOUS_ENCRYPTION_KEY_PATH, jwksEndpoint, accessTokenCookie, oauthConfig.sessionTimeout, (err) => {
      if (err) {
        if (err.message === errorMessages.ACCESS_TOKEN_DECRYPTION_FAILED || err.message === errorMessages.SESSION_EXPIRED) {
          debugMessage("Logout because accessTokenCookie decryption failed or session has expired.")
          return startLogoutPhase(res);
        }

        return webClient.refreshToken(CURRENT_ENCRYPTION_KEY_PATH, PREVIOUS_ENCRYPTION_KEY_PATH, refreshTokenCookie, (err, tokenSet) => {
          if (err) {
            if (err.message === errorMessages.REFRESH_TOKEN_DECRYPTION_FAILED || err.message === errorMessages.SESSION_EXPIRED) {
              debugMessage("Logout because refreshTokenCookie decryption failed or session has expired.")
              return startLogoutPhase(res);
            }
            return sendUnauthorizedResponse(req, res, "Unable to refresh token");
          }

          const cookies = [`accessTokenCookie=${tokenSet.encryptedAccessToken}`, `refreshTokenCookie=${tokenSet.encryptedRefreshToken}`];
          res.writeHead(301, {Location: "/", "Set-Cookie": cookies});
          res.end();
        })
      }

      util.getSSODetectedIdFromEncryptedToken(CURRENT_ENCRYPTION_KEY_PATH, PREVIOUS_ENCRYPTION_KEY_PATH, accessTokenCookie, (err, SSODetectedId)=>{
        if (err) {
            debugMessage("Logout because accessTokenCookie decryption failed or session has expired.")
            return startLogoutPhase(res);
        }

        debugMessage("SSODetectedId", SSODetectedId);
        req.headers["user-id"] = SSODetectedId;
        if (url.includes("/mq/")) {
          return next();
        }
        res.setHeader("Set-Cookie", `sessionExpiryTime=${sessionExpiryTime}; Path=/`)
        util.updateAccessTokenExpiration(CURRENT_ENCRYPTION_KEY_PATH, PREVIOUS_ENCRYPTION_KEY_PATH, accessTokenCookie, (err, encryptedAccessToken)=>{
          if (err) {
            debugMessage("Logout because accessTokenCookie decryption failed.")
            return startLogoutPhase(res);
          }

          const sessionExpiryTime = util.removeTimezoneOffsetFromTimestamp(Date.now()) + oauthConfig.sessionTimeout;
          const cookies = [`sessionExpiryTime=${sessionExpiryTime}; Path=/`, `accessTokenCookie=${encryptedAccessToken}; Path=/`]
          res.setHeader("Set-Cookie", cookies);
          next();
        })
      })
    })
  });
}

module.exports = OAuthMiddleware;
