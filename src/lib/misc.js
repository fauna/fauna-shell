const os = require('os');
const path = require('path');
const fs = require('fs')

var exports = module.exports = {};

exports.getConfigFile = function() {
	return path.join(os.homedir(), '.fauna-shell');
}

exports.getRootKey = function(fileName) {
	return new Promise(function(resolve, reject){
		if (process.env.FAUNA_SECRET_KEY) {
			resolve(process.env.FAUNA_SECRET_KEY);
		} else {
			fs.readFile(fileName, 'utf8', (err, data) => {
				err ? reject(err) : resolve(data.trim());
			});
		}
	});
}