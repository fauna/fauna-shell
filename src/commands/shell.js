const FaunaCommand = require('../lib/fauna_command.js')
const {errorOut} = require('../lib/misc.js')
const faunadb = require('faunadb');
const q = faunadb.query;
const repl = require('repl');
const { stringify } = require('../lib/stringify.js')

function isRecoverableError(error) {
  if (error.name === 'SyntaxError') {
    return /^(Unexpected end of input|Unexpected token)/.test(error.message);
  }
  return false;
}

class ShellCommand extends FaunaCommand {
	async run() {
		const dbscope = this.args.dbname;
		const role = 'admin';
		const log = this.log;
		const withClient = this.withClient.bind(this)

		this.withClient(function(testDbClient, _endpoint) {
			testDbClient.query(q.Exists(q.Database(dbscope)))
			.then(function(exists) {
				if (exists) {
					withClient(function(client, endpoint) {
						log(`Starting shell for database ${dbscope}`);
						log(`Connected to ${endpoint.scheme}://${endpoint.domain}:${endpoint.port}`);
						log(`Type Ctrl+D or .exit to exit the shell`);
						var defaultEval;

						function replEvalPromise(cmd, ctx, filename, cb) {
							if (cmd.trim() == '') {
								return cb()
							}
							defaultEval(cmd, ctx, filename, function(error, result) {
								if (!error) {
									return client.query(result)
									       .then(function(response) {
													 console.log(stringify(response));
													 return cb(error)
									       }) 
									       .catch(function(error) {
													 log("Error:", error.message);
													 return cb()
									       });
								} else {
									if (isRecoverableError(error)) {
										return cb(new repl.Recoverable(error));
									} else {
										return cb(error, result)
									}
								}
							});
						}

						const r	= repl.start({
							prompt: `${dbscope}> `,
							ignoreUndefined: true
						});
						
						// we don't want to allow the custom commands from the node.js repl.
						r.commands = [];
						
						r.defineCommand('exit', {
							help: 'Exit the repl',
							action: function() {
								this.close();
							}
						});
						
						defaultEval = r.eval;
						r.eval = replEvalPromise;

						Object.assign(r.context, q);
					}, dbscope, role);
				} else {
					errorOut(`Database '${dbscope}' doesn't exist`, 1)
				}
			})
			.catch(function(err) {
				errorOut(err, 1)
			})
		})
  }
}

ShellCommand.description = `
Starts a FaunaDB shell
`

ShellCommand.examples = [
	'$ fauna shell dbname'
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