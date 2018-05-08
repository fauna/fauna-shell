const {Command, flags} = require('@oclif/command')

const {getRootKey, getConfigFile} = require('../lib/misc.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class FaunaCommand extends Command {
	withClient(f) {
		getRootKey(getConfigFile())
		.then(function (rootKey) {
			var client = new faunadb.Client({ secret: rootKey });
			f(client);
		})
	}
}

module.exports = FaunaCommand;