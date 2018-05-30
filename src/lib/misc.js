const os = require('os');
const path = require('path');
const fs = require('fs')
const ini = require('ini');

var exports = module.exports = {};

exports.getConfigFile = function() {
	return path.join(os.homedir(), '.fauna-shell');
}

exports.readFile = function(fileName) {
  return new Promise(function(resolve, reject) {
    fs.readFile(fileName, 'utf8', (err, data) => {
			err ? reject(err) : resolve(data);
    })
  })
}

exports.buildConnectionOptions = function (configData, cmdFlags, dbScope, role) {
	const config = ini.parse(configData);
	const connectionOptions = Object.assign(config, cmdFlags);
	return new Promise(function(resolve, reject) {
		if (connectionOptions.secret) {
			connectionOptions.secret = maybeScopeKey(connectionOptions.secret, dbScope, role);
			resolve(connectionOptions);
		} else {
			reject("You must specify a secret key to connet to FaunaDB");
		}
	})
}

function maybeScopeKey(secret, dbScope, role) {
	res = secret;
	if (dbScope !== undefined && role !== undefined) {
		res = secret + ":" + dbScope + ":" + role;
	}
	return res;
}