const openDSU = require("opendsu");
const crypto = openDSU.loadAPI("crypto");
const http = openDSU.loadAPI("http");
const {sendUnauthorizedResponse} = require("../../utils/middlewares");
const config = require("../../config");
const url = require("url");
const util = require("./lib/util");

const serverAuthentication = config.getConfig("serverAuthentication")
if (serverAuthentication) {
    module.exports = require("./lib/OauthMiddleware");
} else {
    module.exports = require("./lib/AccessTokenValidator");
}

