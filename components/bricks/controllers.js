function uploadBrick(request, response, next) {
    $$.flow.start('BricksManager').write(request, (err, result) => {
        if (err) {
            return response.send(err.code === 'EACCES' ? 409 : 500);
        }

        response.send(201, result);
    });
}

function downloadBrick(request, response, next) {
    response.setHeader('content-type', 'application/octet-stream');
    response.setHeader('Cache-control', 'max-age=31536000'); // set brick cache expiry to 1 year

    $$.flow.start('BricksManager').read(request.params.hashLink, res, (err, result) => {
        if (err) {
            return response.send(404, 'Brick not found');
        }

        response.send(200);
    });
}

function downloadMultipleBricks(request, response, next) {
    res.setHeader('content-type', 'application/octet-stream');
    res.setHeader('Cache-control', 'max-age=31536000'); // set brick cache expiry to 1 year

    $$.flow.start('BricksManager').readMultipleBricks(req.query.hashes, res, (err, result) => {
        if (err) {
            return response.send(404, 'Brick not found');
        }

        response.send(200);
    });
}

module.exports = { uploadBrick, downloadBrick, downloadMultipleBricks };
