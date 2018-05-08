const {flags} = require('@oclif/command')
const FaunaCommand = require('../lib/fauna_command.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class CreateDatabaseCommand extends FaunaCommand {
  async run() {
	  const {flags} = this.parse(CreateDatabaseCommand);
	  const name = flags.name || 'default';
	  const log = this.log;
	  
		this.withClient(function(client) {
		  log(`creating database ${name}`);
		  client.query(q.CreateDatabase({ name: name }))
		  .then(function(res) {
			  log(res);
		  })
		  .catch(function(error) {
			  log(error);
		  });
		});
  }
}

CreateDatabaseCommand.description = `
Describe the command here
...
Extra documentation goes here
`

CreateDatabaseCommand.flags = {
  name: flags.string({char: 'n', description: 'database name'}),
}

module.exports = CreateDatabaseCommand
