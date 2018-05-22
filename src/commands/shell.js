const FaunaCommand = require('../lib/fauna_command.js')
const faunadb = require('faunadb');
const q = faunadb.query;
const repl = require('repl');

class ShellCommand extends FaunaCommand {
  async run() {
	  const {flags} = this.parse(ShellCommand);
	  const name = flags.name || 'default';
	  const log = this.log;
	  
		this.withClient(function(client) {
		  log(`starting shell for database ${name}`);
			
			const r	= repl.start({
				prompt: 'faunadb> '
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
		});
  }
}

ShellCommand.description = `
Starts a FaunaDB shell
...
Extra documentation goes here
`

ShellCommand.flags = {
  name: flags.string({char: 'd', description: 'database name'}),
}

module.exports = ShellCommand