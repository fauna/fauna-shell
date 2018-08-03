const os = require('os');
const path = require('path');
const fs = require('fs')
const ini = require('ini');
const {cli} = require('cli-ux')

const FAUNA_CLOUD_DOMAIN = 'db.fauna.com';
const ERROR_NO_DEFAULT_ENDPOINT = "You need to set a default endpoint. \nTry running 'fauna default-endpoint ENDPOINT_ALIAS'.";
const ERROR_WRONG_CLOUD_ENDPOINT = "You already have an endpoint 'cloud' defined and it doesn't point to 'db.fauna.com'.\nPlease fix your '~/.fauna-shell' file.";

/**
 * Takes a parsed endpointURL, an endpoint alias, and the endpoint secret, 
 * and saves it to the .ini config file.
 *
 * - If the endpoint already exists, it will be overwritten, after asking confirmation
 *   from the user.
 * - If no other endpoint exists, then the endpoint will be set as the default one.
 */
function saveEndpointOrError(newEndpoint, alias, secret) {
	loadEndpoints()
	.then(function(endpoints) {
		if (endpointExists(endpoints, alias)) {
			confirmEndpointOverwrite(alias)
			.then(function(overwrite) {
				if (overwrite) {
					saveEndpoint(endpoints, newEndpoint, alias, secret);
				} else {
					process.exit(1);
				}
			})
		} else {
			saveEndpoint(endpoints, newEndpoint, alias, secret)
		}
	})
	.catch(function(err) {
		errorOut(err, 1)
	})
}

/**
 * Validates that the 'cloud' endpoint points to FAUNA_CLOUD_DOMAIN.
 */
function validCloudEndpoint() {
	return loadEndpoints().then(function(config) {
		return new Promise(function(resolve, reject) {
			if (config['cloud']) {
				config['cloud']['domain'] == FAUNA_CLOUD_DOMAIN
					? resolve(true)
					: reject(ERROR_WRONG_CLOUD_ENDPOINT); 
			} else {
				resolve(true);
			}
		});
	})
}

/**
 * Sets `endpoint` as the default endpoint.
 * If `endpoint` doesn't exist, returns an error.
 */
function setDefaultEndpoint(endpoint) {
	return loadEndpoints().then(function(endpoints) {
		return new Promise(function(resolve, reject) {
			if (endpoints[endpoint]) {
				endpoints['default'] = endpoint;
				saveConfig(endpoints)
				resolve(`Endpoint '${endpoint}' set as default endpoint.`);
			} else {
				reject(`Endpoint '${endpoint}' doesn't exist.`);
			}
		})
	});
}

/**
 * Loads the endpoints from the ~/.fauna-shell file.
 * If the file doesn't exist, returns an empty object.
 */
function loadEndpoints() {
	return readFile(getConfigFile())
	.then(function(configData) {
		return ini.parse(configData);
	})
	.catch(function(err) {
		if (fileNotFound(err)) {
			return {}
		}
		throw err;
	});
}

function endpointExists(endpoints, endpointAlias) {
	return endpointAlias in endpoints;
}

function confirmEndpointOverwrite(alias) {
	return cli.confirm(`The '${alias}' endpoint already exists. Overwrite? [y/n]`);
}

function saveEndpoint(config, endpoint, alias, secret) {
	saveConfig(addEndpoint(config, endpoint, alias, secret));
}

function addEndpoint(config, endpoint, alias, secret) {
	if (shouldSetAsDefaultEndpoint(config)) {
		config['default'] = alias;
	}
	config[alias] = buildEndpointObject(endpoint, secret);
	return config;
}

/**
 * If there are no keys in the config, then the endpoint should be the default one.
 */
function shouldSetAsDefaultEndpoint(config) {
	return "default" in config === false;
}

function buildEndpointObject(endpoint, secret) {
	var domain = endpoint.hostname;
	var port = endpoint.port;
	var scheme = endpoint.protocol.slice(0, -1) //the scheme is parsed as 'http:'
	// if the value ends up being null, then Object.assign() will skip the property.
  domain = domain === null ? null : {domain}
	port = port === null ? null : {port}
	scheme = scheme === null ? null : {scheme}
	return Object.assign({}, domain, port, scheme, {secret})
}

/**
 * Converts the `config` data provided to INI format, and then saves it to the
 * ~/.fauna-shell file.
 */
function saveConfig(config) {
	fs.writeFileSync(getConfigFile(), ini.stringify(config), {mode: 0o700});
}

/**
 * Returns the full path to the `.fauna-shell` config file
 */
function getConfigFile() {
	return path.join(os.homedir(), '.fauna-shell');
}

/**
 * Wraps `fs.readFile` into a Promise.
 */
function readFile(fileName) {
  return new Promise(function(resolve, reject) {
    fs.readFile(fileName, 'utf8', (err, data) => {
			err ? reject(err) : resolve(data);
    })
  })
}

/**
 * Tests if an error is of the type "file not found".
 */
function fileNotFound(err) {
	return err.code == 'ENOENT' && err.syscall == 'open' && err.errno == -2;
}

/**
 * Writes `msg` to stderr and exits with `code`.
 */
function errorOut(msg, code) {
	code = code || 1
	process.stderr.write(`${msg}\n`)
	process.exit(code)
}

/**
 * Builds the options provided to the faunajs client.
 * Tries to load the ~/.fauna-shell file and read the default endpoint from there.
 *
 * Assumes that if the file exists, it would have been created by fauna-shell,
 * therefore it would have a defined endpoint.
 *
 * Flags like --host, --port, etc., provided by the CLI take precedence over waht's
 * stored in ~/.fauna-shell.
 *
 * If ~/.fauna-shell doesn't exist, tries to build the connection optios from the
 * flags passed to the script.
 *
 * It always expect a secret key to be set in ~/.fauna-shell or provided via CLI 
 * arguments.
 *
 * @param {Object} cmdFlags - flags passed via the CLI.
 * @param {string} dbScope  - A database name to scope the connection to.
 * @param {string} role     - A user role: 'admin'|'server'|'server-readonly'|'client'.
 */
function buildConnectionOptions(cmdFlags, dbScope, role) {
	return new Promise(function(resolve, reject) {
		readFile(getConfigFile())
		.then(function(configData) {
			var endpoint = {};
			const config = ini.parse(configData);
			if (hasDefaultEndpoint(config)) {
				endpoint = getEndpoint(config);
			} else {
				reject(ERROR_NO_DEFAULT_ENDPOINT);
			}
			const connectionOptions = Object.assign(endpoint, cmdFlags);
			//TODO refactor duplicated code
			if (connectionOptions.secret) {
				resolve(cleanUpConnectionOptions(maybeScopeKey(connectionOptions, dbScope, role)));
			} else {
				reject("You must specify a secret key to connect to FaunaDB");
			}
		})
		.catch(function(err) {
			if (fileNotFound(err)) {
				if (cmdFlags.secret) {
					resolve(cleanUpConnectionOptions(maybeScopeKey(cmdFlags, dbScope, role)));
				} else {
					reject("You must specify a secret key to connect to FaunaDB");
				}
			} else {
				reject(err);
			}
		})
	})
}

function getEndpoint(config) {
	return config[config['default']];
}

function hasDefaultEndpoint(config) {
	return config.hasOwnProperty('default') && config.hasOwnProperty(config['default']);
}

/**
 * Makes sure the connectionOptions options passed to the js client
 * only contain valid properties.
 */
function cleanUpConnectionOptions(connectionOptions) {
	const accepted = ['domain', 'scheme', 'port', 'secret', 'timeout'];
	const res = {};
	accepted.forEach(function(key) {
		if (connectionOptions[key]) {
			res[key] = connectionOptions[key]
		}
	});
	return res;
}

/**
 * If `dbScope` and `role` aren't null, then the secret key is scoped to
 * the `dbScope` database for the provided user `role`.
 */
function maybeScopeKey(config, dbScope, role) {
	scopedSecret = config.secret;
	if (dbScope !== undefined && role !== undefined) {
		scopedSecret = config.secret + ":" + dbScope + ":" + role;
	}
	return Object.assign(config, {secret: scopedSecret});
}

module.exports = {
	saveEndpointOrError: saveEndpointOrError,
	validCloudEndpoint: validCloudEndpoint,
	setDefaultEndpoint: setDefaultEndpoint,
	loadEndpoints: loadEndpoints,
	buildConnectionOptions: buildConnectionOptions,
	errorOut: errorOut
};