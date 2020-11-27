


function Anchoring(server) {

    require('./strategies/FS');
    require('./strategies/ETH');

    const AnchorSubscribe = require('./subscribe');
    const AnchorVersions = require('./versions');
    const  addAnchor = require('./controllers')(server);
    const { responseModifierMiddleware, requestBodyJSONMiddleware } = require('../../utils/middlewares');

    server.use(`/anchor/:domain/*`, responseModifierMiddleware);
    server.put(`/anchor/:domain/add/:keyssi`, requestBodyJSONMiddleware);
    server.put(`/anchor/:domain/add/:keyssi`, addAnchor); // to do : add call in brickledger to store the trasantion call

    AnchorVersions(server);
    AnchorSubscribe(server);

    //todo : check for body & param
    // de verificat daca ce primim in body si parameters este corect si nu e malformat - Pentru entry points apelate din extern
    // ancorare - validat body structure
    // bricks - nu e nimic de validat. Ce se primeste in stream se pune in brick
    // bricksFabric - e folosit intern. Nu validam
    // BricksLedger - e folosit intern. Nu validam
    // todo : de revizuit operatiile I/O  de read/write file codate cu Sync, exceptie bootup. Recodare folosind callback
    // discutat locatie fisiere. Momentan e folosit server.rootFolder. De revizuit codul ca toate sa fie relativ la server.rootFolder
    // pentru deployment locatia va fi mounted. Se poate folosi similar cu implementarea de la bricks :
    //if (typeof process.env.EDFS_BRICK_STORAGE_FOLDER !== 'undefined') {
    //    storageFolder = process.env.EDFS_BRICK_STORAGE_FOLDER;
    //}
    // Intrebare : Ar fi ok sa folosesc aceiasi abordare pentru tot, folosind intrari diferite pentru fiecare entrypoint?
    // validare date primite din exterior
    // revizuire : https://privatesky.xyz/?API/api-hub/overview
}

module.exports = Anchoring;
