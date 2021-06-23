const DOMAIN_NAME = "MQ_DOMAIN";
const SEEDER_FILE_NAME = "mq_JWT_Auth_Seeder";

const defaultSettings = {
	mq_nonce_from_smart_contract: false,
	mq_nonce_from_expiring_uuid: true,
	mq_nonce_expiration_time: 10 * 1000//sec
}

function JWTIssuer() {

	let seeder;

	async function init() {
		const fs = require("fs");
		const opendsu = require("opendsu");
		const keyssiApi = opendsu.loadApi("keyssi");

		try {
			seeder = await $$.promisify(fs.readFile)(SEEDER_FILE_NAME);
		} catch (err) {
			if (err.code !== "ENOENT") {
				console.log("Not able to read the Issuer persistence file needed by JWT Auth Support layer!", err);
			}
		}

		if (seeder) {
			try {
				seeder = keyssiApi.parse(seeder.toString());
				console.log("MQ JWT AUTH Issuer loaded.");
				return;
			} catch (err) {
				console.log("Failed to load MQ JWT AUTH Issuer info. Creating a new Issuer!",
					"\nPrevious tokens will not be valid anymore!!!");
			}
		}

		//TODO: what happens if it fails to generate and write to file?

		seeder = await $$.promisify(keyssiApi.createSeedSSI)(DOMAIN_NAME);
		await $$.promisify(fs.writeFile)(SEEDER_FILE_NAME, seeder.getIdentifier());
		console.log("New MQ JWT AUTH Issuer created and saved for later use.");
	}

	this.createToken = function (domain, options, callback) {
		if (typeof options === "function") {
			callback = options;
			options = {};
		}

		function createToken() {
			const opendsu = require("opendsu");
			const crypto = opendsu.loadApi("crypto");
			const keyssiApi = opendsu.loadApi("keyssi");
			const scope = "/mq";
			const credentials = options.credentials || [];

			keyssiApi.createTemplateSeedSSI(domain, (err, subject) => {
				if (err) {
					return callback(err);
				}
				options.subject = subject;
				//setting the JWT token valid period based on the config
				options.valability = defaultSettings.mq_nonce_expiration_time;

				return crypto.createJWT(seeder, scope, credentials, options, (err, token)=>{
					if(err){
						return callback(err);
					}
					crypto.parseJWTSegments(token, (err, segments)=>{
						if(err){
							return callback(err);
						}
						return callback(undefined, {token, expires: segments.body.exp*1000});
					});
				});
			});
		}

		if (!seeder) {
			init().then(createToken);
			return;
		}

		createToken();
	}

	this.validateToken = function (token, callback) {
		function validateToken() {
			const opendsu = require("opendsu");
			const crypto = opendsu.loadApi("crypto");
			return crypto.verifyJWT(token, null, callback);
		}

		if (!seeder) {
			init().then(validateToken);
			return;
		}

		validateToken();
	}

	this.isOwner = function (token, resource, callback) {
		this.validateToken(token, (err, valid) => {
			if (err || !valid) {
				return callback(err || new Error("Invalid token"));
			}

			const opendsu = require("opendsu");
			const crypto = opendsu.loadApi("crypto");
			return crypto.parseJWTSegments(token, (err, segments) => {
				if (err) {
					return callback(err);
				}
				const valid = segments && segments.body && Array.isArray(segments.body.credentials) && segments.body.credentials.indexOf(resource) !== -1;
				return callback(undefined, valid);
			});
		});
	}
}

module.exports = JWTIssuer;