const os = require('os');
const path = require('path');
const fs = require('fs')
const ini = require('ini');

var exports = module.exports = {};

exports.buildConnectionOptions = function (cmdFlags, dbScope, role) {
	return new Promise(function(resolve, reject) {
		readFile(getConfigFile())
		.then(function(configData) {
			const config = ini.parse(configData);
			const connectionOptions = Object.assign(config, cmdFlags);
			//TODO refactor duplicated code
			if (connectionOptions.secret) {
				resolve(maybeScopeKey(connectionOptions, dbScope, role));
			} else {
				reject("You must specify a secret key to connect to FaunaDB");
			}
		})
		.catch(function(err) {
			if (err.code == 'ENOENT' && err.syscall == 'open' && err.errno == -2) {
				if (cmdFlags.secret) {
					resolve(maybeScopeKey(connectionOptions, dbScope, role))
				} else {
					reject("You must specify a secret key to connect to FaunaDB");
				}
			} else {
				reject(err);
			}
		})
	})
}

getConfigFile = function() {
	return path.join(os.homedir(), '.fauna-shell');
}

readFile = function(fileName) {
  return new Promise(function(resolve, reject) {
    fs.readFile(fileName, 'utf8', (err, data) => {
			err ? reject(err) : resolve(data);
    })
  })
}

function maybeScopeKey(config, dbScope, role) {
	scopedSecret = config.secret;
	if (dbScope !== undefined && role !== undefined) {
		scopedSecret = config.secret + ":" + dbScope + ":" + role;
	}
	return Object.assign(config, {secret: scopedSecret});
}