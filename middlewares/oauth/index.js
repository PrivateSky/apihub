const config = require("../../config");

const serverAuthentication = config.getConfig("serverAuthentication")
if (serverAuthentication) {
    module.exports = require("./lib/OauthMiddleware");
} else {
    module.exports = require("./lib/AccessTokenValidator");
}

