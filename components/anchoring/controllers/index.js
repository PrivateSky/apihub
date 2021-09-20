const { ALIAS_SYNC_ERR_CODE } = require("../utils");
const { getDomainConfig } = require("../../../config");
const { getLocalBdnsEntryListExcludingSelfAsync, getHeadersWithExcludedProvidersIncludingSelf } = require("../../../utils/request-utils");
const { shuffle } = require("../../../utils/array");

const DEFAULT_MAX_SAMPLING_ANCHORING_ENTRIES = 10;

function getHandlerForAnchorCreateOrAppend(response) {
    return (err, _) => {
        if (err) {
            const errorMessage = typeof err === "string" ? err : err.message;
            if (err.code === "EACCES") {
                return response.send(409, errorMessage);
            } else if (err.code === ALIAS_SYNC_ERR_CODE) {
                // see: https://tools.ietf.org/html/rfc6585#section-3
                return response.send(428, errorMessage);
            } else if (err.code === 403) {
                return response.send(403, errorMessage);
            }

            return response.send(500, errorMessage);
        }

        response.send(201);
    };
}

async function getAllVersionsFromExternalProviders(request) {
    const { domain, anchorId } = request.params;
    console.log("[Anchoring] Getting external providers...");
    let anchoringProviders = await getLocalBdnsEntryListExcludingSelfAsync(request, domain, "anchoringServices");
    console.log(`[Anchoring] Found ${anchoringProviders.length} external provider(s)`);
    if (!anchoringProviders || !anchoringProviders.length) {
        throw new Error(`[Anchoring] Found no fallback anchoring providers!`);
    }

    // shuffle the providers and take maxSamplingAnchoringEntries of them
    const maxSamplingAnchoringEntries =
        getDomainConfig(domain, "anchoring", "maxSamplingAnchoringEntries") || DEFAULT_MAX_SAMPLING_ANCHORING_ENTRIES;
    shuffle(anchoringProviders);

    //filter out $ORIGIN type providers (placeholders).
    anchoringProviders = anchoringProviders.filter( provider =>{
        return provider !== "$ORIGIN";
    });

    anchoringProviders = anchoringProviders.slice(0, maxSamplingAnchoringEntries);

    // we need to get the versions from all the external providers and compute the common versions as the end result
    const allExternalVersions = [];

    const http = require("opendsu").loadApi("http");
    for (let i = 0; i < anchoringProviders.length; i++) {
        const providerUrl = anchoringProviders[i];
        try {
            const anchorUrl = `${providerUrl}/anchor/${domain}/get-all-versions/${anchorId}`;
            let providerResponse = await http.fetch(anchorUrl, {
                headers: getHeadersWithExcludedProvidersIncludingSelf(request),
            });
            let providerVersions = await providerResponse.json();

            providerVersions = providerVersions || []; // consider we have no version when the anchor is not created
            allExternalVersions.push(providerVersions);
        } catch (error) {
            console.warn(`[Anchoring] Failed to get anchor ${anchorId} from ${providerUrl}!`, error);
        }
    }

    const existingExternalVersions = allExternalVersions.filter((versions) => versions && versions.length);
    const existingVersionsCount = existingExternalVersions.length;

    console.log(
        `[Anchoring] Queried ${anchoringProviders.length} provider(s), out of which ${existingVersionsCount} have versions`
    );

    if (!existingVersionsCount) {
        // none of the queried providers have the anchor
        return [];
    }

    const minVersionsLength = Math.min(...existingExternalVersions.map((versions) => versions.length));
    const firstProviderVersions = existingExternalVersions[0];
    const commonVersions = [];
    for (let i = 0; i < minVersionsLength; i++) {
        const version = firstProviderVersions[i];
        const isVersionPresentInAllProviders = existingExternalVersions.every((versions) => versions.includes(version));
        if (isVersionPresentInAllProviders) {
            commonVersions.push(version);
        } else {
            break;
        }
    }

    console.log(`[Anchoring] Anchor ${anchorId} has ${commonVersions.length} version(s) based on computation`);
    return commonVersions;
}

function createAnchor(request, response) {
    request.strategy.createAnchor(getHandlerForAnchorCreateOrAppend(response));
}

function appendToAnchor(request, response) {
    request.strategy.appendToAnchor(getHandlerForAnchorCreateOrAppend(response));
}

function getAllVersions(request, response) {
    request.strategy.getAllVersions(async (err, fileHashes) => {
        response.setHeader("Content-Type", "application/json");

        if (err) {
            return response.send(404, "Anchor not found");
        }

        if (fileHashes) {
            return response.send(200, fileHashes);
        }

        try {
            const allVersions = await getAllVersionsFromExternalProviders(request);
            return response.send(200, allVersions);
        } catch (error) {
            console.warn(`[Anchoring] Error while trying to get missing anchor from fallback providers!`, error);
        }

        // signal that the anchor doesn't exist
        response.send(200, null);
    });
}

module.exports = {
    createAnchor,
    appendToAnchor,
    getAllVersions,
};
