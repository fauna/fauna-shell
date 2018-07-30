const os = require('os');
const path = require('path');
const fs = require('fs')
const ini = require('ini');
const url = require('url')
const {cli} = require('cli-ux')

const ERROR_NO_DEFAULT_ENDPOINT = "You need to set a default endpoint. \nTry running 'fauna default-endpoint ENDPOINT_ALIAS' or run fauna --help to see a list of commands.";
const ERROR_WRONG_CLOUD_ENDPOINT = "You already have an endpoint 'cloud' defined and it doesn't point to 'db.fauna.com'.\nPlease fix your '~/.fauna-shell' file.";

function handleConfigOrError(configData, endpoint, secret, alias) {
	handleConfig(configData, endpoint, secret, alias)
	.catch(function(err) {
		// there was an error inside handleConfig
		errorOut(err, 1);
	})
}

const handleConfig = async function(configData, endpointURL, secret, alias) {
	const endpoint = url.parse(endpointURL);
	if (!endpoint.hostname) {
		throw "You must provide a valid endpoint";
	}
	
	var config = configData ? ini.parse(configData) : {}
	
	// are we overwriting an already setup alias?
	if (config[alias]) {
		// is the alias the special one called 'cloud'?
		if (alias == 'cloud') {
			// is the cloud domain pointing to the right domain?
			if (!validCloudEndpoint(config)) {
				throw ERROR_WRONG_CLOUD_ENDPOINT;
			}
		}

		const ow = await cli.confirm(`The '${alias}' endpoint already exists. Overwrite? [y/n]`);
		if (!ow) {
			process.exit(1);
		}
	}

	if (shouldSetAsDefaultEndpoint(config)) {
		config['default'] = alias;
	}
	config[alias] = buildEndpointObject(endpoint, secret);	
	saveConfig(config);
}

function validCloudEndpoint(config) {
	return config['cloud']['domain'] == 'db.fauna.com';
}

/**
 * If there are no keys in the config, then the endpoint should be the default one.
 */
function shouldSetAsDefaultEndpoint(config) {
	return Object.keys(config).length == 0;
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

function saveConfig(config) {
	fs.writeFileSync(getConfigFile(), ini.stringify(config), {mode: 0o700});
}

function getConfigFile() {
	return path.join(os.homedir(), '.fauna-shell');
}

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

function errorOut(msg, code) {
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
	handleConfigOrError: handleConfigOrError,
	fileNotFound: fileNotFound,
	buildConnectionOptions: buildConnectionOptions,
	getConfigFile: getConfigFile,
	readFile: readFile,
	errorOut: errorOut,
	saveConfig: saveConfig
};