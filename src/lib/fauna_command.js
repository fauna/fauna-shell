const {Command, flags} = require('@oclif/command')
const {buildConnectionOptions, errorOut} = require('../lib/misc.js')
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

		buildConnectionOptions(cmdFlags, dbScope, role)
		.then(function(connectionOptions) {
			var client = new faunadb.Client(connectionOptions);
			//TODO this should return a Promise
			f(client, connectionOptions);
		})
		.catch(function(err) {
			errorOut(err, 1)
		});
	}
	
	query(queryExpr, logMsg) {
		const log = this.log;
		this.withClient(function(client, endpoint) {
		  log(logMsg);
		  client.query(queryExpr)
		  .then(function(res) {
			  log(res);
		  })
		  .catch(function(error) {
				errorOut(`Error: ${error.message}`, 1)
		  });
		});
	}
	
	query2(queryExpr, logMsg, success, failure) {
		const log = this.log;
		this.withClient(function(client, endpoint) {
		  log(logMsg);
		  client.query(queryExpr)
		  .then(success)
		  .catch(failure);
		});
	}
	
	paginate(queryExpr, logMsg, emptyMessage) {
		const log = this.log;
		this.withClient(function(client, endpoint) {
			log(logMsg);
			var results = [];
			var helper = client.paginate(queryExpr);
			helper.each(function(page) {
				results.push(page)
			}).then(function(done) {
				if (results.length > 0) {
					var tmp = [].concat.apply([], results)
					tmp.sort()
					tmp.forEach(function(item) {
						log(item.id);
					})
				} else {
					log(emptyMessage)
				}
			});
		});
	}
}

FaunaCommand.flags = {
	...Command.flags,
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