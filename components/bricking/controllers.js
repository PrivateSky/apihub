function getBrick(request, response) {
    response.setHeader('content-type', 'application/octet-stream');
    response.setHeader('Cache-control', 'max-age=31536000'); // set brick cache to expire in 1 year

    request.fsBrickStorage.getBrick(request.params.hashLink, (error, result) => {
        if (error) {
            const message = `[Bricking] Brick '${request.params.hashLink}' not found!`;
            console.error('[Bricking]', error, message);
            return response.send(404, message);
        }

        response.write(result);
        return response.send(200);
    });
}

function putBrick(request, response) {
    request.fsBrickStorage.utils.convertReadableStreamToBuffer(request, (error, brickData) => {
        if (error) {
            console.error('[Bricking] Fail to convert Stream to Buffer!', error);
            return response.send(500);
        }

        request.fsBrickStorage.addBrick(brickData, (error, brickHash) => {
            if (error) {
                console.error('[Bricking] Fail to manage current brick!', error);
                return response.send(error.code === 'EACCES' ? 409 : 500);
            }

            return response.send(201, brickHash);
        });
    });
}

function downloadMultipleBricks(request, response) {
    response.setHeader('content-type', 'application/octet-stream');
    response.setHeader('Cache-control', 'max-age=31536000'); // set brick cache to expire in 1 year

    let { hashes } = request.query;

    if (!Array.isArray(hashes)) {
        hashes = [hashes];
    }

    const responses = hashes.map(hash => request.fsBrickStorage.getBrickAsync(hash))
    Promise.all(responses).then((bricks) => {
        response.write(bricks);
        response.send(200);
    });
}

module.exports = {
    getBrick,
    putBrick,
    downloadMultipleBricks
};
