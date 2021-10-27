const openDSU = require("opendsu");
const crypto = openDSU.loadApi("crypto");

const {sendUnauthorizedResponse} = require("../../utils/middlewares");

function Authorisation(server) {
  console.log(`Registering Authorisation middleware`);

  const config = require("../../config");
  const skipJWTAuthorisation = config.getConfig("skipJWTAuthorisation");

  const urlsToSkip = skipJWTAuthorisation && Array.isArray(skipJWTAuthorisation) ? skipJWTAuthorisation : [];

  server.use(function (req, res, next) {
    let { url } = req;
    let jwt = req.headers['authorization'];

    const canSkipJWTAuthorisation = urlsToSkip.some((urlToSkip) => url.indexOf(urlToSkip) === 0);
    if (url === "/" || canSkipJWTAuthorisation) {
      next();
      return;
    }

    if (!config.getConfig("enableLocalhostAuthorization") && req.headers.host.indexOf("localhost") === 0) {
      next();
      return;
    }

    if (!jwt) {
      return sendUnauthorizedResponse(req, res, "Missing required Authorization header");
    }

    config.getTokenIssuers((err, tokenIssuers) => {
      if (err) {
        return sendUnauthorizedResponse(req, res, "error while getting token issuers", err);
      }

      jwt = jwt.replace("Bearer ", "");
      crypto.verifyAuthToken(jwt, tokenIssuers, (error, isValid) => {
        if (error || !isValid) {
          return sendUnauthorizedResponse(req, res, "JWT could not be verified", error);
        }

        next();
      });
    });
  });
}

module.exports = Authorisation;
