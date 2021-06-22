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

	mq_nonce_from_smart_contract: false,
	mq_nonce_from_expiring_uuid: true,
	mq_nonce_expiration_time: 10 * 1000,//sec

	mq_throttling: 2, //2 per second
	mq_allow_unregistered_did: false,
	mq_max_size: 10000 //10k
}

function MQHub(server) {

	const config = require("./../../config/index");

	const JWTIssuer = require("./auth/JWTIssuer");
	const issuer = new JWTIssuer();

	let domains = []; //config.getConfiguredDomains();

	function getTokenHandler(request, response) {
		const domain = request.params.domain;
		issuer.createToken(domain, {credentials: request.params.hashDID}, (err, token) => {
			if (err) {
				console.log("Not able to create a new token.", err);
				response.statusCode = 500;
				return response.end();
			}

			response.statusCode = 200;
			response.write(token);
			response.end();
		});
	}

	function putMessageHandler(request, response, next) {
		if (domains.indexOf(request.params.domain) === -1) {
			response.statusCode = 405;
			response.end();
			return;
		}

		let token = request.headers['authorization'];
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

	function getMessageHandler(request, response, next) {
		if (domains.indexOf(request.params.domain) === -1) {
			response.statusCode = 405;
			response.end();
			return;
		}

		let token = request.headers['authorization'];
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


	function setupDomainSpecificHandlers() {
		let confDomains = typeof config.getConfiguredDomains !== "undefined" ? config.getConfiguredDomains() : ["default"];

		for (let i = 0; i < confDomains.length; i++) {
			let domain = confDomains[i];
			let domainConfig = config.getDomainConfig(domain);

			if (domainConfig.enable && domainConfig.enable.indexOf("mq") !== -1) {
				const adapterTypeName = domainConfig["mq_type"] || "local";
				const adapter = adapterImpls[adapterTypeName];
				if (!adapter) {
					console.log(`Not able to recognize the mq_type < ${adapterTypeName} > from the domain < ${domain} > config.`);
					continue;
				}

				try {
					console.log(`Preparing to register mq endpoints for domain < ${domain} > ... `);
					adapter(server, URL_PREFIX, domain, domainConfig);
				} catch (err) {
					console.log(`Caught an error during initialization process of the mq for domain < ${domain} >`, err);
					continue;
				}

				console.log(`Successfully register mq endpoints for domain < ${domain} >.`);
				domains.push(domain);
			}
		}
	}

	setupDomainSpecificHandlers();
}

module.exports = {
	MQHub
};