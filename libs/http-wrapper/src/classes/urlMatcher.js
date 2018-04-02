function matchUrl(pattern, url) {
    let patternTokens = pattern.split('/');
    let urlTokens = url.split('/');

    let result = {
        match: true,
        params: {}
    };

    if (patternTokens.length !== urlTokens.length) {
        result.match = false;
    }

    for (let i = 0; i < patternTokens.length && result.match; ++i) {
        if (patternTokens[i].startsWith(':')) {
            result.params[patternTokens[i].substring(1)] = urlTokens[i];
        } else if (patternTokens[i] !== urlTokens[i]) {
            result.match = false;
        }
    }

    return result;
}

exports.matchUrl = matchUrl;