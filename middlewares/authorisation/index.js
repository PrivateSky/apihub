const openDSU = require("opendsu");
const crypto = openDSU.loadApi("crypto");

function sendUnauthorizedResponse(res) {
  res.statusCode = 403;
  res.end();
}

function Authorisation(server) {
  console.log(`Registering Authorisation middleware`);

  const config = require("../../config");
  const skipAuthorisation = config.getConfig("skipAuthorisation");
  console.log({ skipAuthorisation });

  const urlsToSkip = skipAuthorisation && Array.isArray(skipAuthorisation) ? skipAuthorisation : [];

  server.use(function (req, res, next) {
    const { url } = req;
    const jwt = req.headers.Authorization;

    const canSkipAuthorisation = urlsToSkip.some((urlToSkip) => url.indexOf(urlToSkip) === 0);
    if (canSkipAuthorisation) {
      next();
      return;
    }

    console.log({url})

    if (!jwt) {
      console.error("Missing required Authorization header");
      return sendUnauthorizedResponse(res);
    }

    config.getTokenIssuers((err, tokenIssuers) => {
      if (err) {
        return sendUnauthorizedResponse(res);
      }

      crypto.verifyAuthToken(jwt, tokenIssuers, (error, isValid) => {
        if (error || !isValid) {
          console.error(`[${req.method}] ${req.url} BLOCKED`, error);
          return sendUnauthorizedResponse(res);
        }

        next();
      });
    });
  });
}

module.exports = Authorisation;
