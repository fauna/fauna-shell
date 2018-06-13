const FaunaCommand = require('../lib/fauna_command.js')
const faunadb = require('faunadb');
const q = faunadb.query;
const repl = require('repl');

class ShellCommand extends FaunaCommand {
	async run() {
		const dbscope = this.args.dbname;
		const role = 'admin';
		const log = this.log;
		const withClient = this.withClient.bind(this)

		this.withClient(function(testDbClient) {
			testDbClient.query(q.Exists(q.Database(dbscope)))
			.then(function(exists) {
				if (exists) {
					withClient(function(client) {
						log(`starting shell for database ${dbscope}`);

						const r	= repl.start({
							prompt: 'faunadb> ',
							ignoreUndefined: true
						});

						const query = function (exp) {
							client.query(exp)
							.then(function(res) {
								console.log("\n", res);
								r.displayPrompt();
							})
							.catch(function(error) {
								console.log("\n", "Error:", error.message);
								r.displayPrompt();
							});
						};

						Object.assign(r.context, q);

						Object.defineProperty(r.context, 'query', {
							configurable: false,
							enumerable: true,
							value: query
						});
					}, dbscope, role);
				} else {
					console.log(`Database '${dbscope}' doesn't exist`)
				}
			})
			.catch(function(err) {
				log(err);
			})
		})
  }
}

ShellCommand.description = `
Starts a FaunaDB shell
`

ShellCommand.examples = [
	'$ fauna-shell dbname'
]

ShellCommand.flags = {
	...FaunaCommand.flags
}

ShellCommand.args = [
	{
		name: 'dbname', 
		required: true, 
		description: 'database name'
	},
]

module.exports = ShellCommand