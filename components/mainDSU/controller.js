const config = require("../../config");
const logger = $$.getLogger("controller", "apihub/mainDSU");

let mainDSUSeedSSI = null;
let rootFolderPath;
let mainDSUSeedSSIFilePath;

function init(server) {
    logger.info(`Registering MainDSU component`);
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
    let mainDSUAnchorId;
    try {
        mainDSUAnchorId = await $$.promisify(mainDSUSeedSSI.getAnchorId)();
        const fileContent = await $$.promisify(fs.readFile)(mainDSUSeedSSIFilePath, { encoding: "utf-8" });
        mainDSUSeedSSI = keySSISpace.parse(fileContent);
        logger.info(`[MainDSU] Read existing mainDSU from ${mainDSUSeedSSIFilePath}: ${mainDSUAnchorId}`);
        return sendMainDSUSeedSSI(response);
    } catch (error) {
        logger.error(`[MainDSU] Failed to read/parse keySSI from ${mainDSUSeedSSIFilePath}. Generating new keySSI...`, error);
    }

    try {
        mainDSUAnchorId = await $$.promisify(mainDSUSeedSSI.getAnchorId)();
        const environmentJsPath = require("path").join(rootFolderPath, "environment.js");
        logger.info(`[MainDSU] Loading environment.js config file from: ${environmentJsPath}`);

        const environmentConfig = require(environmentJsPath);

        const seedSSI = await $$.promisify(keySSISpace.createSeedSSI)(environmentConfig.vaultDomain);
        const mainDSU = await $$.promisify(resolver.createDSUForExistingSSI)(seedSSI);

        logger.info(`[MainDSU] Settings config for seed ${await $$.promisify(seedSSI.getAnchorId)()}`, environmentConfig);
        await $$.promisify(mainDSU.writeFile)("/environment.json", JSON.stringify(environmentConfig));

        mainDSUSeedSSI = seedSSI;
        logger.info("[MainDSU] Generated mainDSUSeedSSI: ", mainDSUAnchorId, mainDSUSeedSSI);

        logger.info(`[MainDSU] Writing generated mainDSU to ${mainDSUSeedSSIFilePath}: ${mainDSUAnchorId}`);
        await $$.promisify(fs.writeFile)(mainDSUSeedSSIFilePath, mainDSUSeedSSI.getIdentifier(), "utf-8");

        sendMainDSUSeedSSI(response);
    } catch (error) {
        logger.error("[MainDSU] Failed to create seedSSI", error);
        response.statusCode = 500;
        response.setHeader("Content-Type", "text/html");
        response.end("Failed to create seedSSI");
    }
}

module.exports = {
    init,
    handleDefaultMainDSURequest,
};
