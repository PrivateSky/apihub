const DATABASE_NAME = "adminEnclave";

const DOMAINS_TABLE = "domains";
const ADMINS_TABLE = "admins";
const TEMPLATES_TABLE = "templates";

const DID_replacement = "";

let internalServerRef;

function getStorageFolder(){
    const config = internalServerRef.config;

    return require("path").join(internalServerRef.rootFolder, config.componentsConfig.admin.storageFolder);
}

function getMainDomainStorageFile() {
    const storageFolder = getStorageFolder();
    return require("path").join(storageFolder, "mainDomain");
}

function getEnclave() {
    const storageFolder = require("path").join(getStorageFolder(), DATABASE_NAME);
    const Enclave = require("default-enclave");
    return new Enclave(storageFolder);
}

function getMainDomain(callback) {
    const FS = "fs";
    const fs = require(FS);
    fs.readFile(getMainDomainStorageFile(), callback);
}

function saveMainDomain(domain, callback) {
    getMainDomain((err, mainDomain) => {
        if (err || !mainDomain) {
            const FS = "fs";
            const fs = require(FS);
            fs.mkdir(getStorageFolder(), {recursive: true}, (err)=>{
                if(err){
                    return callback(err);
                }
                fs.writeFile(getMainDomainStorageFile(), domain, {}, callback);
            });
        } else {
            return callback(`There is a domain set as mainDomain. Not able to save <${domain}> as main domain.`);
        }
    });
}

function isMainDomain(domain, callback) {
    getMainDomain((err, mainDomain) => {
        if (err || !mainDomain) {
            return saveMainDomain(domain, (err) => {
                if (err) {
                    return callback(err);
                }
                callback(undefined, true);
            });
        }
        return callback(undefined, mainDomain.toString() === domain);
    });
}

function AdminComponentHandler(server) {

    internalServerRef = server;

    let adminService = new AdminService(true);

    async function enforceMainDomainMiddleware(req, res, next){
        let {mainDomain} = req.params;
        let testIfMainDomain = $$.promisify(isMainDomain);
        try{
            let isMain = await testIfMainDomain(mainDomain);
            if (!isMain) {
                res.statusCode = 403;
                return res.end();
            }
        }catch(err){
            res.statusCode = 500;
            return res.end();
        }
        next();
    }

    async function addDomain(req, res) {
        let {domainName, timestamp, signature, cloneFromDomain} = req.body;

        if(!cloneFromDomain){
            res.statusCode = 403;
            res.end();
        }

        try {
            await adminService.addDomainAsync(domainName, cloneFromDomain, timestamp, signature);
        } catch (err) {
            res.statusCode = 500;
            return res.end();
        }

        res.statusCode = 200;
        res.end();
    }

    async function disableDomain(req, res) {
        let {domainName, timestamp, signature} = req.body;
        try {
            await adminService.disableDomainAsync(domainName, timestamp, signature);
        } catch (err) {
            res.statusCode = 500;
            return res.end();
        }

        res.statusCode = 200;
        res.end();
    }

    async function addAdmin(req, res) {
        let {did, timestamp, signature} = req.body;

        try {
            await adminService.registerAdminAsync(did, timestamp, signature);
        } catch (err) {
            res.statusCode = 500;
            return res.end();
        }

        res.statusCode = 200;
        res.end();
    }

    async function addDomainAdmin(req, res) {
        let {domain, did, timestamp, signature} = req.body;

        try {
            await adminService.registerDomainAdminAsync(domain, did, timestamp, signature);
        } catch (err) {
            res.statusCode = 500;
            return res.end();
        }

        res.statusCode = 200;
        res.end();
    }

    async function registerTemplate(req, res) {
        let {path, content, timestamp, signature} = req.body;
        try {
            await adminService.registerTemplateAsync(path, content, timestamp, signature);
        } catch (err) {
            res.statusCode = 500;
            return res.end();
        }

        res.statusCode = 200;
        res.end();
    }

    async function setVariable(req, res){
        let {domainName} = req.params;
        let {variableName, variableContent, timestamp, signature} = req.body;

        try {
            await adminService.registerVariableToDomainAsync(domainName, variableName, variableContent, timestamp, signature);
        } catch (err) {
            res.statusCode = 500;
            return res.end();
        }

        res.statusCode = 200;
        res.end();
    }

    server.use("/admin/:mainDomain/*", enforceMainDomainMiddleware);

    server.use("/admin/*", require("./../../utils/middlewares/index").requestBodyJSONMiddleware);

    server.post("/admin/:mainDomain/addDomain", addDomain);
    server.post("/admin/:mainDomain/disableDomain", disableDomain);
    server.post("/admin/:mainDomain/addAdmin", addAdmin);
    server.post("/admin/:mainDomain/addDomainAdmin", addDomainAdmin);
    server.post("/admin/:mainDomain/:domainName/storeVariable", setVariable);
    server.post("/admin/:mainDomain/registerTemplate", registerTemplate);
}

function AdminService(exposeAllApis) {
    const enclave = getEnclave();

    this.getDomains = function (callback) {
        enclave.getAllRecords(DID_replacement, DOMAINS_TABLE, callback);
    }

    this.getMainDomain = getMainDomain;

    this.checkForTemplate = function (path, callback) {
        const filter = "pk == ${path}";
        enclave.filter(DID_replacement, TEMPLATES_TABLE, filter, (err, template)=>{
            //cleanup template obj before returning it
            return callback(err, template);
        });
    }

    this.checkIfAdmin = function(did, callback){
        enclave.getRecord(DID_replacement, ADMINS_TABLE, did, (err, admin)=>{
            if(err || !admin){
                return callback(undefined, false);
            }
            return callback(undefined, true);
        });
    }

    this.checkIfDomainAdmin = function(domainName, did, callback){
        enclave.getRecord(DID_replacement, DOMAINS_TABLE, domainName, (err, domain)=>{
            if(err || !domain || !domain.admins || domain.admins.indexOf(did) === -1){
                return callback(undefined, false);
            }

            return callback(undefined, true);
        });
    }

    this.getDomainSpecificVariables = function(domainName, callback){
        enclave.getRecord(DID_replacement, DOMAINS_TABLE, domainName, (err, domain)=>{
            if(err){
                return callback(err);
            }

            if(!domain){
                return callback(`Not able to find domain ${domainName}.`);
            }

            return callback(undefined, domain.variables || {});
        });
    }

    //from this line down there are only methods that change the state of the enclave.
    if (exposeAllApis) {
        this.addDomain = async function (domainName, cloneFromDomain, timestamp, signature, callback) {
            enclave.insertRecord(DID_replacement, DOMAINS_TABLE, domainName, {name:domainName, active: true, cloneFromDomain}, callback);
        }

        this.addDomainAsync = $$.promisify(this.addDomain);

        this.disableDomain = async function (domainName, timestamp, signature, callback) {
            enclave.updateRecord(DID_replacement, DOMAINS_TABLE, domainName, {name: domainName, active:false}, callback);
        }

        this.disableDomainAsync = $$.promisify(this.disableDomain);

        this.registerAdmin = function (did, timestamp, signature, callback) {
            enclave.insertRecord(DID_replacement, ADMINS_TABLE, did, {did, active: true}, callback);
        }

        this.registerAdminAsync = $$.promisify(this.registerAdmin);

        this.registerDomainAdmin = function (domainName, did, timestamp, signature, callback) {
            enclave.getRecord(DID_replacement, DOMAINS_TABLE, domainName, (err, domain)=>{
                if(err){
                    return callback(err);
                }

                if(!domain.admins){
                    domain.admins = [];
                }
                domain.admins.push(did);

                enclave.updateRecord(DID_replacement, DOMAINS_TABLE, domainName, domain, callback);
            });
        }

        this.registerDomainAdminAsync = $$.promisify(this.registerDomainAdmin);

        this.registerVariableToDomain = function (domainName, variableName, variableContent, timestamp, signature, callback){
            enclave.getRecord(DID_replacement, DOMAINS_TABLE, domainName, (err, domain)=>{
                if(err){
                    return callback(err);
                }

                if(!domain.variables){
                    domain.variables = {};
                }

                domain.variables[variableName] = variableContent;

                enclave.updateRecord(DID_replacement, DOMAINS_TABLE, domainName, domain, callback);
            });
        }
        this.registerVariableToDomainAsync = $$.promisify(this.registerVariableToDomain);

        this.registerTemplate = function (path, content, timestamp, signature, callback) {
            enclave.insertRecord(DID_replacement, TEMPLATES_TABLE, path, {content}, callback);
        }

        this.registerTemplateAsync = $$.promisify(this.registerTemplate);
    }

    return this;
}

function getAdminService() {
    if (!internalServerRef) {
        throw new Error("AdminComponentHandler is not enabled!");
    }

    return new AdminService();
}

module.exports = {
    AdminComponentHandler,
    getAdminService
};