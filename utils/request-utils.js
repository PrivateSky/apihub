const logger = $$.getLogger("request-utils", "apihub/utils");

function getCurrentApiHubUrl(server) {
    const config = require("../config");
    const currentApiHubUrl = `${server.protocol}://${config.getConfig("host")}:${config.getConfig("port")}`;
    return currentApiHubUrl;
}

function getExcludedProvidersFromRequest(request) {
    let excludedProviders = request.headers["excluded-providers"];
    if (!excludedProviders) {
        return [];
    }

    excludedProviders = excludedProviders
        .split(",")
        .map((provider) => provider.trim())
        .filter((provider) => provider);
    return excludedProviders;
}

function getHeadersWithExcludedProvidersIncludingSelf(request) {
    let excludedProviders = request.headers["excluded-providers"] || "";
    if (excludedProviders) {
        excludedProviders += ",";
    }
    const currentApiHubUrl = getCurrentApiHubUrl(request.server);
    excludedProviders = `${excludedProviders}${currentApiHubUrl}`;

    return {
        "Excluded-Providers": excludedProviders,
    };
}

async function getLocalBdnsEntryListExcludingSelfAsync(request, domain, entryName) {
    const { server } = request;
    let entries;

    try {
        // trying to get the entries via contract call
        const entriesUrl = `/contracts/${domain}/bdns-entries/anchoringServices`;
        entries = await server.makeLocalRequestAsync("GET", entriesUrl);
    } catch (error) {
        logger.error(`[${entryName}] Failed to call contract to get ${entryName}. Falling back to local bdns check`);

        try {
            const bdnsUrl = `/bdns`;
            const bdns = await server.makeLocalRequestAsync("GET", bdnsUrl);
            if (bdns && bdns[domain]) {
                entries = bdns[domain][entryName];
            }
        } catch (error) {
            logger.error(`[${entryName}] Failed to call BDNS to get ${entryName}`);
        }
    }

    if (entries && Array.isArray(entries)) {
        // remove self url from the list
        const currentApiHubUrl = getCurrentApiHubUrl(server);
        entries = entries.filter((url) => url && url.indexOf(currentApiHubUrl) === -1);

        // remove providers specified in the Excluded-Providers headers in order to avoid cyclic calls
        const excludedProviders = getExcludedProvidersFromRequest(request);
        if (excludedProviders.length) {
            entries = entries.filter(
                (provider) => !excludedProviders.some((excludedProvider) => excludedProvider.indexOf(provider) !== -1)
            );
        }
    }

    return entries;
}

module.exports = {
    getLocalBdnsEntryListExcludingSelfAsync,
    getHeadersWithExcludedProvidersIncludingSelf,
};
