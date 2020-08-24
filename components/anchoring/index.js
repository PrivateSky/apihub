
function Anchoring(server) {
    server.put('/anchoring', (request, response, next) => {
        await anchoringService.addAnchor(hashLink).catch(err=> response.send(400, err.message || 'Something went wrong'));
        
        next();
    });
}

module.exports = Anchoring;
