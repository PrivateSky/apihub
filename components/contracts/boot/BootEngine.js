function BootEngine(domain, domainConfig, rootFolder) {
    const openDSU = require("opendsu");
    const { constants } = openDSU;
    const resolver = openDSU.loadApi("resolver");

    console.log(
        `[contract-worker] booting contracts for domain ${domain} and domainConfig ${JSON.stringify(domainConfig)} booting...`,
        domainConfig
    );

    const getContractConfigs = async () => {
        const listFiles = $$.promisify(this.rawDossier.listFiles);
        const codeFolderFiles = await listFiles(constants.CODE_FOLDER);

        const contractConfigs = codeFolderFiles
            .filter((file) => file)
            .map((file) => (fileParts = file.split("/")))
            .filter((fileParts) => fileParts.length === 2 && fileParts[1].endsWith(".js"))
            .map((fileParts) => {
                return {
                    name: fileParts[0],
                    filePath: [constants.CODE_FOLDER, ...fileParts].join("/"),
                };
            });
        return contractConfigs;
    };

    this.boot = async function (callback) {
        try {
            const loadRawDossier = $$.promisify(resolver.loadDSU);
            try {
                this.rawDossier = await loadRawDossier(domainConfig.constitution);
                global.rawDossier = this.rawDossier;
            } catch (err) {
                console.log(err);
                return callback(err);
            }

            const readFile = $$.promisify(this.rawDossier.readFile);

            const contractConfigs = await getContractConfigs();

            let bootHandler;
            const bootContract = contractConfigs.find((contract) => contract.name === "boot");
            if (bootContract) {
                const bootContractIndex = contractConfigs.findIndex((contract) => contract === bootContract);
                contractConfigs.splice(bootContractIndex, 1);

                try {
                    var bootFileContent = await readFile(bootContract.filePath);
                    const BootClass = eval(`(${bootFileContent.toString()})`);
                    bootHandler = new BootClass(domain, domainConfig, rootFolder);
                    await $$.promisify(bootHandler.init.bind(bootHandler))();
                } catch (e) {
                    console.log("[contract-worker] Failed to initialize boot", e);
                    throw e;
                }
            }

            const contracts = {};

            for (let i = 0; i < contractConfigs.length; i++) {
                const contractConfig = contractConfigs[i];
                var fileContent = await readFile(contractConfig.filePath);
                try {
                    const ContractClass = eval(`(${fileContent.toString()})`);
                    const contract = new ContractClass();

                    // ensure that all contract methods (invarious of how there are called) have "this" bound to the contract instance
                    const classMethodNames = Object.getOwnPropertyNames(ContractClass.prototype).filter(
                        (methodName) => methodName !== "constructor" && typeof ContractClass.prototype[methodName] === "function"
                    );
                    classMethodNames.forEach((methodName) => {
                        contract[methodName] = contract[methodName].bind(contract);
                    });

                    if (bootHandler) {
                        await $$.promisify(bootHandler.setContractMixin.bind(bootHandler))(contractConfig.name, contract);
                    }

                    // run initialization step if the init function is defined
                    if (typeof contract.init === "function") {
                        await $$.promisify(contract.init)();
                    }

                    contracts[contractConfig.name] = contract;
                } catch (e) {
                    console.log("contract-worker Failed to eval file", contractConfig.name, e);
                    throw e;
                }
            }

            if (bootHandler) {
                bootHandler.setContracts(contracts);
            }

            callback(undefined, contracts);
        } catch (error) {
            callback(error);
        }
    };
}

module.exports = BootEngine;
