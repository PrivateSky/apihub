const extensionsMimeTypes = {
    "aac": {
        name: "audio/aac",
        binary: true
    },
    "abw": {
        name: "application/x-abiword",
        binary: true
    },
    "arc": {
        name: "application/x-freearc",
        binary: true
    },
    "avi": {
        name: "video/x-msvideo",
        binary: true
    },
    "azw": {
        name: "application/vnd.amazon.ebook",
        binary: true
    },
    "bin": {
        name: "application/octet-stream",
        binary: true
    }, "bmp": {
        name: "image/bmp",
        binary: true
    }, "bz": {
        name: "application/x-bzip",
        binary: true
    }, "bz2": {
        name: "application/x-bzip2",
        binary: true
    }, "csh": {
        name: "application/x-csh",
        binary: false
    }, "css": {
        name: "text/css",
        binary: false
    }, "csv": {
        name: "text/csv",
        binary: false
    }, "doc": {
        name: "application/msword",
        binary: true
    }, "docx": {
        name: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        binary: true
    }, "eot": {
        name: "application/vnd.ms-fontobject",
        binary: true
    }, "epub": {
        name: "application/epub+zip",
        binary: true
    }, "gz": {
        name: "application/gzip",
        binary: true
    }, "gif": {
        name: "image/gif",
        binary: true
    }, "htm": {
        name: "text/html",
        binary: false
    }, "html": {
        name: "text/html",
        binary: false
    }, "ico": {
        name: "image/vnd.microsoft.icon",
        binary: true
    }, "ics": {
        name: "text/calendar",
        binary: false
    }, "jpeg": {
        name: "image/jpeg",
        binary: true
    }, "jpg": {
        name: "image/jpeg",
        binary: true
    }, "js": {
        name: "text/javascript",
        binary: false
    }, "json": {
        name: "application/json",
        binary: false
    }, "jsonld": {
        name: "application/ld+json",
        binary: false
    }, "mid": {
        name: "audio/midi",
        binary: true
    }, "midi": {
        name: "audio/midi",
        binary: true
    }, "mjs": {
        name: "text/javascript",
        binary: false
    }, "mp3": {
        name: "audio/mpeg",
        binary: true
    }, "mpeg": {
        name: "video/mpeg",
        binary: true
    }, "mpkg": {
        name: "application/vnd.apple.installer+xm",
        binary: true
    }, "odp": {
        name: "application/vnd.oasis.opendocument.presentation",
        binary: true
    }, "ods": {
        name: "application/vnd.oasis.opendocument.spreadsheet",
        binary: true
    }, "odt": {
        name: "application/vnd.oasis.opendocument.text",
        binary: true
    }, "oga": {
        name: "audio/ogg",
        binary: true
    },
    "ogv": {
        name: "video/ogg",
        binary: true
    },
    "ogx": {
        name: "application/ogg",
        binary: true
    },
    "opus": {
        name: "audio/opus",
        binary: true
    },
    "otf": {
        name: "font/otf",
        binary: true
    },
    "png": {
        name: "image/png",
        binary: true
    },
    "pdf": {
        name: "application/pdf",
        binary: true
    },
    "php": {
        name: "application/php",
        binary: false
    },
    "ppt": {
        name: "application/vnd.ms-powerpoint",
        binary: true
    },
    "pptx": {
        name: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        binary: true
    },
    "rtf": {
        name: "application/rtf",
        binary: true
    },
    "sh": {
        name: "application/x-sh",
        binary: false
    },
    "svg": {
        name: "image/svg+xml",
        binary: false
    },
    "swf": {
        name: "application/x-shockwave-flash",
        binary: true
    },
    "tar": {
        name: "application/x-tar",
        binary: true
    },
    "tif": {
        name: "image/tiff",
        binary: true
    },
    "tiff": {
        name: "image/tiff",
        binary: true
    },
    "ts": {
        name: "video/mp2t",
        binary: true
    },
    "ttf": {
        name: "font/ttf",
        binary: true
    },
    "txt": {
        name: "text/plain",
        binary: false
    },
    "vsd": {
        name: "application/vnd.visio",
        binary: true
    },
    "wav": {
        name: "audio/wav",
        binary: true
    },
    "weba": {
        name: "audio/webm",
        binary: true
    },
    "webm": {
        name: "video/webm",
        binary: true
    },
    "webp": {
        name: "image/webp",
        binary: true
    },
    "woff": {
        name: "font/woff",
        binary: true
    },
    "woff2": {
        name: "font/woff2",
        binary: true
    },
    "xhtml": {
        name: "application/xhtml+xml",
        binary: false
    },
    "xls": {
        name: "application/vnd.ms-excel",
        binary: true
    },
    "xlsx": {
        name: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        binary: true
    },
    "xml": {
        name: "text/xml",
        binary: false
    },
    "xul": {
        name: "application/vnd.mozilla.xul+xml",
        binary: true
    },
    "zip": {
        name: "application/zip",
        binary: true
    },
    "3gp": {
        name: "video/3gpp",
        binary: true
    },
    "3g2": {
        name: "video/3gpp2",
        binary: true
    },
    "7z": {
        name: "application/x-7z-compressed",
        binary: true
    }
};

const defaultMimeType = {
    name: "text/plain",
    binary: false
};
module.exports = function (extension) {
    if (typeof extensionsMimeTypes[extension] !== "undefined") {
        return extensionsMimeTypes[extension];
    }
    return defaultMimeType;
};