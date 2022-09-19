const config = require("../../config");

let mainDSUSeedSSI = null;
let rootFolderPath;
let mainDSUSeedSSIFilePath;

function init(server) {
    console.log(`Registering MainDSU component`);
    rootFolderPath = server.rootFolder;
    mainDSUSeedSSIFilePath = require("path").join(server.rootFolder, config.getConfig("externalStorage"), "maindsu");
}

function sendMainDSUSeedSSI(response) {
    response.statusCode = 200;
    response.write(mainDSUSeedSSI.getIdentifier());
    response.end();
}

async function handleDefaultMainDSURequest(request, response) {
    if (mainDSUSeedSSI) {
        return sendMainDSUSeedSSI(response);
    }

    const fs = require("fs");
    const keySSISpace = require("opendsu").loadApi("keyssi");
    const resolver = require("opendsu").loadApi("resolver");

    try {
        const fileContent = await $$.promisify(fs.readFile)(mainDSUSeedSSIFilePath, { encoding: "utf-8" });
        mainDSUSeedSSI = keySSISpace.parse(fileContent);
        console.log(`[MainDSU] Read existing mainDSU from ${mainDSUSeedSSIFilePath}: ${mainDSUSeedSSI.getIdentifier()}`);
        return sendMainDSUSeedSSI(response);
    } catch (error) {
        console.log(`[MainDSU] Failed to read/parse keySSI from ${mainDSUSeedSSIFilePath}. Generating new keySSI...`, error);
    }

    try {
        const environmentJsPath = require("path").join(rootFolderPath, "environment.js");
        console.log(`[MainDSU] Loading environment.js config file from: ${environmentJsPath}`);

        const environmentConfig = require(environmentJsPath);

        const seedSSI = await $$.promisify(keySSISpace.createSeedSSI)(environmentConfig.vaultDomain);
        const mainDSU = await $$.promisify(resolver.createDSUForExistingSSI)(seedSSI);

        console.log(`[MainDSU] Settings config for seed ${seedSSI.getIdentifier()}`, environmentConfig);
        await $$.promisify(mainDSU.writeFile)("/environment.json", JSON.stringify(environmentConfig));

        mainDSUSeedSSI = seedSSI;
        console.log("[MainDSU] Generated mainDSUSeedSSI: ", mainDSUSeedSSI.getIdentifier(), mainDSUSeedSSI);

        console.log(`[MainDSU] Writing generated mainDSU to ${mainDSUSeedSSIFilePath}: ${mainDSUSeedSSI.getIdentifier()}`);
        await $$.promisify(fs.writeFile)(mainDSUSeedSSIFilePath, mainDSUSeedSSI.getIdentifier(), "utf-8");

        sendMainDSUSeedSSI(response);
    } catch (error) {
        console.log("[MainDSU] Failed to create seedSSI", error);
        response.statusCode = 500;
        response.setHeader("Content-Type", "text/html");
        response.end("Failed to create seedSSI");
    }
}

module.exports = {
    init,
    handleDefaultMainDSURequest,
};
