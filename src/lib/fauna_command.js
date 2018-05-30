const {Command, flags} = require('@oclif/command')
const {readFile, getConfigFile, buildConnectionOptions} = require('../lib/misc.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class FaunaCommand extends Command {
	
	async init() {
		const {flags: f, args: a} = this.parse(this.constructor)
		this.flags = f;
		this.args = a;
	}
			
	withClient(f, dbScope, role) {
		const log = this.log
		const cmdFlags = this.flags;
		readFile(getConfigFile())
		.then(function(configData) {
			return buildConnectionOptions(configData, cmdFlags, dbScope, role)
		})
		.then(function(connectionOptions) {
			var client = new faunadb.Client(connectionOptions);
			//TODO this should return a Promise
			f(client);
		})
		.catch(function(err) {
			//TODO this should reject instead of logging
			if (err.code == 'ENOENT' && err.syscall == 'open' && err.errno == -2) {
				log(`Error: File ${err.path} not found. \nYou must create one as explained in the project README.`);
			} else {
				log(err);
			}
		});
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

FaunaCommand.flags = {
	domain: flags.string({
    description: 'FaunaDB server domain',
  }),
	scheme: flags.string({
    description: 'Connection scheme',
		options: ['https', 'http'],
  }),
	port: flags.string({
    description: 'Connection port',
  }),
	timeout: flags.string({
    description: 'Connection timeout in milliseconds',
  }),
	secret: flags.string({
		description: 'FaunaDB secret key',
  }),
}

module.exports = FaunaCommand;