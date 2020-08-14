
function responseWrapper(body) {
    if (typeof body === 'string') {
        return JSON.stringify({ message: body });
    }

    return JSON.stringify(body);
}

module.exports = responseWrapper;
