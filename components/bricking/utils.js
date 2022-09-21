const { clone } = require("../../utils");
const { getLocalBdnsEntryListExcludingSelfAsync, getHeadersWithExcludedProvidersIncludingSelf } = require("../../utils/request-utils");
const logger = $$.getLogger("bricking", "apihub/bricking")
function convertReadableStreamToBuffer(readStream, callback) {
    let buffers = [];

    readStream.on("data", (chunk) => buffers.push(chunk));

    readStream.on("error", (error) => callback(error));

    readStream.on("end", () => callback(undefined, $$.Buffer.concat(buffers)));
}

async function getBricksDomainConfig(domain) {
    logger.info("Looking for domain", domain);
    const config = require("../../config");
    let domainConfiguration = await config.getSafeDomainConfig(domain);

    if (!domainConfiguration) {
        return;
    }

    let domainConfig = domainConfiguration.bricking;

    domainConfig = clone(domainConfig || {});
    domainConfig.path = require("path").join(config.getConfig("externalStorage"), `domains/${domain}/brick-storage`);

    return domainConfig;
}

async function getBrickFromExternalProvidersAsync(request, domain, hashLink) {
    let brickingProviders = await getLocalBdnsEntryListExcludingSelfAsync(request, domain, "brickStorages");

    if (!brickingProviders || !brickingProviders.length) {
        throw new Error(`[Bricking] Found no fallback bricking providers!`);
    }

    const http = require("opendsu").loadApi("http");
    for (let i = 0; i < brickingProviders.length; i++) {
        const providerUrl = brickingProviders[i];
        try {
            const brickUrl = `${providerUrl}/bricking/${domain}/get-brick/${hashLink}`;
            let providerResponse = await http.fetch(brickUrl, {
                headers: getHeadersWithExcludedProvidersIncludingSelf(request),
            });
            providerResponse = await providerResponse.text();
            return providerResponse;
        } catch (error) {
            // logger.warn(`[Bricking] Failed to get brick ${hashLink} from ${providerUrl}!`, error);
        }
    }

    throw new Error(`[Bricking] Could not load brick ${hashLink} from external providers`);
}

async function getBrickWithExternalProvidersFallbackAsync(request, domain, hashLink, fsBrickStorage) {
    try {
        const brick = await fsBrickStorage.getBrickAsync(hashLink);
        if (brick) {
            return brick;
        }
    } catch (error) {
        logger.warn(`[Bricking] Brick ${hashLink} not found. Trying to fallback to other providers...`);
    }

    try {
        const externalBrick = await getBrickFromExternalProvidersAsync(request, domain, hashLink);

        // saving the brick in the next cycle in order to not block the get brick request
        setTimeout(async () => {
            try {
                console.info(`[Bricking] Saving external brick ${hashLink} to own storage...`);
                await fsBrickStorage.addBrickAsync(externalBrick);
                console.info(`[Bricking] Saved external brick ${hashLink} to own storage`);
            } catch (error) {
                logger.warn("[Bricking] Fail to manage external brick saving!", error);
            }
        });

        return externalBrick;
    } catch (error) {
        logger.warn(`[Bricking] Error while trying to get missing brick from fallback providers!`, error);
        throw error;
    }
}

module.exports = {
    convertReadableStreamToBuffer,
    getBricksDomainConfig,
    getBrickWithExternalProvidersFallbackAsync,
};
