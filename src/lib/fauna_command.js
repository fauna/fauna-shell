const {Command} = require('@oclif/command')

const {getRootKey, getConfigFile} = require('../lib/misc.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class FaunaCommand extends Command {
			
	withClient(f, dbScope, role) {
		const log = this.log
		getRootKey(getConfigFile())
		.then(function (rootKey) {
			var secret = rootKey;	
			if (dbScope !== undefined && role !== undefined) {
				secret = rootKey + ":" + dbScope + ":" + role;
			}
			
			var client = new faunadb.Client({ secret: secret });
			f(client);
		}).catch(function(err) {
			if (err.code == 'ENOENT' && err.syscall == 'open' && err.errno == -2) {
				log(`Error: File ${err.path} not found. \nYou must create one as explained in the project README.`);
			} else {
				log(err);
			}
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
	
	paginate(queryExpr, logMsg) {
		const log = this.log;
		this.withClient(function(client) {
			log(logMsg);
			var helper = client.paginate(queryExpr);
			helper.each(function(page) {
				log(page);
			});
		});
	}
}

module.exports = FaunaCommand;