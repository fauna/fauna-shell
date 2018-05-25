const {Command} = require('@oclif/command')

const {getRootKey, getConfigFile} = require('../lib/misc.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class FaunaCommand extends Command {
			
	withClient(f, dbScope, role) {
		getRootKey(getConfigFile())
		.then(function (rootKey) {
			var secret = rootKey;	
			if (dbScope !== undefined && role !== undefined) {
				secret = rootKey + ":" + dbScope + ":" + role;
			}
			
			var client = new faunadb.Client({ secret: secret });
			f(client);
		})
	}
	
	query(queryExpr, logMsg) {
		const log = this.log;
		this.withClient(function(client) {
		  log(logMsg);
		  client.query(queryExpr)
		  .then(function(res) {
			  log(res);
		  })
		  .catch(function(error) {
			  log("Error:", error.message);
		  });
		});
	}
}

module.exports = FaunaCommand;