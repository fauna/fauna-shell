const {Command, flags} = require('@oclif/command')
const {getRootKey, getConfigFile} = require('../lib/misc.js')
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
		const connectionOptions = {
			domain: this.flags.domain,
			scheme: this.flags.scheme,
			port: this.flags.port,
			timeout: this.flags.timeout
		};
		
		getRootKey(getConfigFile())
		.then(function (rootKey) {
			var secret = rootKey;
			if (dbScope !== undefined && role !== undefined) {
				secret = rootKey + ":" + dbScope + ":" + role;
			}
			
			connectionOptions.secret = secret;
			var client = new faunadb.Client(connectionOptions);
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

FaunaCommand.flags = {
	domain: flags.string({
    description: 'FaunaDB server domain',
    default: 'db.fauna.com',
  }),
	scheme: flags.string({
    description: 'Connection scheme.',
		options: ['https', 'http'],
		default: 'https',
  }),
	port: flags.string({
    description: 'Connection port',
    default: 443,
  }),
	timeout: flags.string({
    description: 'Connection timeout in milliseconds',
		default: 80,
  })
}

module.exports = FaunaCommand;