function BootEngine(domain, domainConfig) {
    const openDSU = require("opendsu");
    const { constants } = openDSU;
    const resolver = openDSU.loadApi("resolver");

    console.log(
        `[worker] booting contracts for domain ${domain} and domainConfig ${JSON.stringify(domainConfig)} booting...`,
        domainConfig
    );

    const getContractConfigs = async () => {
        const listFiles = promisify(this.rawDossier.listFiles);
        const codeFolderFiles = await listFiles(constants.CODE_FOLDER);
        console.log("codeFolderFiles", codeFolderFiles);

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
            const loadRawDossier = promisify(resolver.loadDSU);
            try {
                this.rawDossier = await loadRawDossier(domainConfig.constitution);
                global.rawDossier = this.rawDossier;
            } catch (err) {
                console.log(err);
                return callback(err);
            }

            const readFile = promisify(this.rawDossier.readFile);

            const contractConfigs = await getContractConfigs();
            console.log("contractConfigs", contractConfigs);

            let bootHandler;
            const bootContract = contractConfigs.find((contract) => contract.name === "boot");
            if (bootContract) {
                const bootContractIndex = contractConfigs.findIndex((contract) => contract === bootContract);
                contractConfigs.splice(bootContractIndex, 1);

                try {
                    var bootFileContent = await readFile(bootContract.filePath);
                    const BootClass = eval(`(${bootFileContent.toString()})`);
                    bootHandler = new BootClass(domain, domainConfig);
                    await promisify(bootHandler.init.bind(bootHandler))();
                } catch (e) {
                    console.log("Failed to initialize boot", e);
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

                    if (bootHandler) {
                        await promisify(bootHandler.setContractMixin.bind(bootHandler))(contractConfig.name, contract);
                    }

                    contracts[contractConfig.name] = contract;
                } catch (e) {
                    console.log("Failed to eval file", contractConfig.name, e);
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

function promisify(fn) {
    return function (...args) {
        return new Promise((resolve, reject) => {
            fn(...args, (err, ...res) => {
                if (err) {
                    console.log(err);
                    reject(err);
                } else {
                    resolve(...res);
                }
            });
        });
    };
}

module.exports = BootEngine;
