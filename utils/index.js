module.exports.clone = function(data) {
    return JSON.parse(JSON.stringify(data));
}

module.exports.streams = require("./streams");
module.exports.requests = require("./requests");
module.exports.responseWrapper = require("./responseWrapper");
module.exports.getMimeTypeFromExtension = require("./mimeType");