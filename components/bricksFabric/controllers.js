
function createHandler(flow, server) {

    return function storeTransaction (request, response, next) {

        console.log('store anchored called');
        //strategy is already booted up
        flow.storeData(request.body, server, (err, result) => {
            if (err) {
                return response.send(500,"Failed to store transaction."+ err.toString());
            }
            response.send(201, result);
        });

    }
}


module.exports = createHandler;