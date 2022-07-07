const config = require("../../config");
const URL_PREFIX = "/mq";
//known implementations for the MQ adapters
const adapterImpls = {
	local: require("./adapters/localMQAdapter.js"),
	solace: require("./adapters/solaceMQAdapter.js")
};

//just to expose the possibility to add new implementations for the adapters
function registerMQAdapterImpl(adapterName, adapterImpl) {
	adapterImpls[adapterName] = adapterImpl;
}

const defaultSettings = {
	// normally there are gateways timeouts of 30seconds
	mq_client_timeout: 60 * 1000,//sec
	// not sure about the response.setTimeout(msecs[, callback]) available on nodejs docs

	mq_throttling: 2, //2 per second
	mq_allow_unregistered_did: false
}

async function MQHub(server, signalAsyncLoading, doneLoading) {

	signalAsyncLoading();

	const config = require("./../../config/index");

	const JWTIssuer = require("./auth/JWTIssuer");
	const issuer = new JWTIssuer();

	let domains = []; //config.getConfiguredDomains();

	function getTokenHandler(request, response) {
		const domain = request.params.domain;
		issuer.createToken(domain, {credentials: request.params.hashDID}, (err, tokenObj) => {
			if (err) {
				console.log("Not able to create a new token.", err);
				response.statusCode = 500;
				return response.end();
			}

			const mqConfig = config.getConfig("componentsConfig", "mq");
			if (mqConfig && mqConfig.connectionTimeout) {
				response.writeHead(200, {
					"connection-timeout": mqConfig.connectionTimeout
				});
			} else {
				response.statusCode = 200;
			}

			response.write(JSON.stringify(tokenObj));
			response.end();
		});
	}

	async function allowUnregisteredDID(domainName){
		const domainConfig = await config.getSafeDomainConfig(domainName);
		let allowUnregisteredDID = defaultSettings.mq_allow_unregistered_did;
		if(domainConfig && typeof domainConfig.mq_allow_unregistered_did !== "undefined"){
			allowUnregisteredDID = !!domainConfig.mq_allow_unregistered_did;
		}
		return allowUnregisteredDID;
	}

	async function putMessageHandler(request, response, next) {
		const domainName = request.params.domain;
		if (domains.indexOf(domainName) === -1) {
			console.log(`Caught an request to the MQs for domain ${domainName}. Looks like the domain doesn't have mq component enabled.`);
			response.statusCode = 405;
			response.end();
			return;
		}

		let token = request.headers['authorization'];

		if(! await allowUnregisteredDID(domainName) && !token){
			console.log(`No token was available on the request and the domain ${domainName} configuration prohibits unregisteredDIDs to use the MQ api.`);
			response.statusCode = 403;
			response.end();
			return;
		}

		issuer.validateToken(token, (err, valid) => {
			let errorMsg = "Not able to validate token: ";
			if (!valid) {
				errorMsg = "Token not valid: ";
			}
			if (err || !valid) {
				console.log(`${errorMsg} < ${token} >`, err ? err : "");
				response.statusCode = 403;
				response.end();
				return;
			}

			//all good continue to the domain specific mq handler
			return next();
		});
	}

	async function getMessageHandler(request, response, next) {
		const domainName = request.params.domain;
		if (domains.indexOf(domainName) === -1) {
			console.log(`Caught an request to the MQs for domain ${domainName}. Looks like the domain doesn't have mq component enabled.`);
			response.statusCode = 405;
			response.end();
			return;
		}

		let token = request.headers['authorization'];

		if(! await allowUnregisteredDID(domainName) && !token){
			console.log(`No token was available on the request and the domain ${domainName} configuration prohibits unregisteredDIDs to use the MQ api.`);
			response.statusCode = 403;
			response.end();
			return;
		}

		issuer.isOwner(token, request.params.hashDID, (err, isOwner) => {
			let errorMsg = "Not able to validate authorization token: ";
			if (!isOwner) {
				errorMsg = "Ownership not confirmed based on token: ";
			}
			if (err || !isOwner) {
				console.log(`${errorMsg} < ${token} >`, err ? err : "");
				response.statusCode = 403;
				response.end();
				return;
			}

			//all good continue to the domain specific mq handler
			return next();
		});
	}

	function deleteMessageHandler(request, response, next) {
		getMessageHandler(request, response, next);
	}

	function takeMessageHandler(request, response, next) {
		getMessageHandler(request, response, next);
	}

	server.get(`${URL_PREFIX}/:domain/:hashDID/token`, getTokenHandler); //> JWT Token

	server.put(`${URL_PREFIX}/:domain/put/:hashDID`, putMessageHandler); //< message

	server.get(`${URL_PREFIX}/:domain/get/:hashDID/:signature_of_did`, getMessageHandler); //  > {message}
	server.delete(`${URL_PREFIX}/:domain/delete/:hashDID/:messageID/:signature_of_did`, deleteMessageHandler);

	server.get(`${URL_PREFIX}/:domain/take/:hashDID/:signature_of_did`, takeMessageHandler); //  > message

	function testIfMQEnabled(domain, domainToBeUsedByAdapter){
		let domainConfig = config.getDomainConfig(domain);

		if (domainConfig && domainConfig.enable && domainConfig.enable.indexOf("mq") !== -1) {
			const adapterTypeName = domainConfig["mq_type"] || "local";
			const adapter = adapterImpls[adapterTypeName];
			if (!adapter) {
				console.log(`Not able to recognize the mq_type < ${adapterTypeName} > from the domain < ${domain} > config.`);
				return;
			}

			try {
				console.log(`Preparing to register mq endpoints for domain < ${domain} > ... `);
				adapter(server, URL_PREFIX, domainToBeUsedByAdapter || domain, domainConfig);
			} catch (err) {
				console.log(`Caught an error during initialization process of the mq for domain < ${domain} >`, err);
				return;
			}

			return true;
		}
	}

	async function setupDomainSpecificHandlers() {
		let confDomains = typeof config.getConfiguredDomains !== "undefined" ? config.getConfiguredDomains() : ["default"];
		try{
			let adminService = require("./../../components/admin").getAdminService();
			let getDomains = $$.promisify(adminService.getDomains);
			let virtualDomains = await getDomains();
			//console.log("virtualDomains", virtualDomains);
			for(let i=0; i<virtualDomains.length; i++){
				let domainInfo = virtualDomains[i];
				//console.log("domain info", domainInfo);
				if(domainInfo && domainInfo.active && domainInfo.cloneFromDomain){
					if(testIfMQEnabled(domainInfo.cloneFromDomain, domainInfo.pk)){
						console.log(`Successfully register mq endpoints for virtual domain < ${domainInfo.pk} >.`);
						domains.push(domainInfo.pk);
					}
				}
			}
		}catch(err){
			//we ignore any errors;
		}

		for (let i = 0; i < confDomains.length; i++) {
			let domain = confDomains[i];
			if(testIfMQEnabled(domain)){
				console.log(`Successfully register mq endpoints for domain < ${domain} >.`);
				domains.push(domain);
			}
		}
	}

	await setupDomainSpecificHandlers();
	doneLoading();
}

module.exports = {
	MQHub
};
