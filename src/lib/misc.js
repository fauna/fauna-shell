const os = require('os');
const path = require('path');
const fs = require('fs')
const ini = require('ini');
const url = require('url')
const {cli} = require('cli-ux')

const saveConfig = function(config) {
	fs.writeFileSync(getConfigFile(), ini.stringify(config), {mode: 0o700});
}

const handleConfig = async function(configData, endpointURL, secret, alias) {
	const endpoint = url.parse(endpointURL);
	if (!endpoint.hostname) {
		throw "You must provide a valid endpoint";
	}
	
	const config = configData ? ini.parse(configData) : {}
	
	// are we overwriting an already setup alias?
	if (config[alias]) {
		// is the alias the special one called 'cloud'?
		if (alias == 'cloud') {
			// is the cloud domain pointing to the right domain?
			if (config['cloud']['domain'] != 'db.fauna.com') {
				throw "You already have an endpoint 'cloud' defined and it doesn't point to 'db.fauna.com'.\nPlease fix your '~/.fauna-shell' file.";
			}
		}

		const ow = await cli.confirm(`The '${alias}' endpoint already exists. Overwrite? [y/n]`);
		if (!ow) {
			process.exit(0);
		}
	}

	// if we don't have any endopints, then the new one will be enabled
	var enabled = Object.keys(config).length == 0 ? true : false
	// if the endpoint already exists, we might need to keep it enabled if it was
	if (config['default'] == alias) {
		enabled = true;
	}

	var domain = endpoint.hostname;
	var port = endpoint.port;
	var scheme = endpoint.protocol.slice(0, -1) //the scheme is parsed as 'http:'
  domain = domain === null ? null : {domain}
	port = port === null ? null : {port}
	scheme = scheme === null ? null : {scheme}
	config[alias] = {}
	if (enabled) {
		config['default'] = alias;
	}

	Object.assign(config[alias], domain, port, scheme, {secret})
	saveConfig(config)
}

function handleConfigOrError(configData, endpoint, secret, alias) {
	handleConfig(configData, endpoint, secret, alias)
	.catch(function(err) {
		// there was an error inside handleConfig
		errorOut(err, 1);
	})
}

function fileNotFound(err) {
	return err.code == 'ENOENT' && err.syscall == 'open' && err.errno == -2;
}

function buildConnectionOptions(cmdFlags, dbScope, role) {
	return new Promise(function(resolve, reject) {
		readFile(getConfigFile())
		.then(function(configData) {
			const config = ini.parse(configData);
			var endpoint = {};
			var keys = Object.keys(config);
			if (config.hasOwnProperty('default') && config.hasOwnProperty(config['default'])) {
				endpoint = config[config['default']]
			} else {
				reject("You need to set a default endpoint. \nTry running 'fauna default-endpoint ENDPOINT_ALIAS' or run fauna --help to see a list of commands.");
			}
			
			const connectionOptions = Object.assign(endpoint, cmdFlags);
			//TODO refactor duplicated code
			if (connectionOptions.secret) {
				resolve(maybeScopeKey(connectionOptions, dbScope, role));
			} else {
				reject("You must specify a secret key to connect to FaunaDB");
			}
		})
		.catch(function(err) {
			if (fileNotFound(err)) {
				if (cmdFlags.secret) {
					resolve(maybeScopeKey(connectionOptions, dbScope, role));
				} else {
					reject("You must specify a secret key to connect to FaunaDB");
				}
			} else {
				reject(err);
			}
		})
	})
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

function errorOut(msg, code) {
	process.stderr.write(`${msg}\n`)
	process.exit(code)
}

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