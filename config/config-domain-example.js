const defaultDomainConfig = {
    anchoring: {
        type: "FS",
        option: {
            enableBricksLedger: false,
        },
        commands: {
            addAnchor: "anchor",
        },
    },
    bricksFabric: {
        name: "BrickStorage",
        option: {
            timeout: 15000,
            transactionsPerBlock: 5,
        },
    },
};

module.exports = Object.freeze(defaultDomainConfig);
