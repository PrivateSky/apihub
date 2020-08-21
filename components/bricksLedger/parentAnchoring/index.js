
function ParentAnchoring(server) {
    server.put('/bricks-ledger/pas/anchor/:hashLink', (request, response, next) => {
        response.send(200, { test: 'ok' });
        next();
    });
}

module.exports = ParentAnchoring;
