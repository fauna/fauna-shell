const FaunaCommand = require('../lib/fauna_command.js')
const faunadb = require('faunadb');
const q = faunadb.query;
const repl = require('repl');

class ShellCommand extends FaunaCommand {
	async run() {
		const {args} = this.parse(ShellCommand);
		const dbscope = args.dbname;
		const role = 'admin';
		const log = this.log;

		this.withClient(function(client) {
			log(`starting shell for database ${dbscope}`);

			const r	= repl.start({
				prompt: 'faunadb> ',
				ignoreUndefined: true
			});

			const query = function (exp) {
				client.query(exp)
				.then(function(res) {
					console.log(res);
					r.displayPrompt();
				})
				.catch(function(error) {
					console.log(error);
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
  }
}

ShellCommand.description = `
Starts a FaunaDB shell
`

ShellCommand.examples = [
	'$ fauna-shell dbname'
]

ShellCommand.args = [
	{
		name: 'dbname', 
		required: true, 
		description: 'database name'
	},
]

module.exports = ShellCommand