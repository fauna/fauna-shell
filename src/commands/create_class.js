const {flags} = require('@oclif/command')
const FaunaCommand = require('../lib/fauna_command.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class CreateClassCommand extends FaunaCommand {
  async run() {
	  const {flags} = this.parse(CreateClassCommand);
	  const name = flags.name || 'default';
		const database = flags.database || '';
	  const log = this.log;
		const dbScope = database;
		const role = "admin";
		
		this.withClient(function(client) {
		  client.query(q.CreateClass({ name: name }))
		  .then(function(res) {
			  log(res);
		  })
		  .catch(function(error) {
			  log(error);
		  });
		}, dbScope, role);
  }
}

CreateClassCommand.description = `
Describe the command here
...
Extra documentation goes here
`

CreateClassCommand.flags = {
  name: flags.string({char: 'n', description: 'class name'}),
  database: flags.string({char: 'd', description: 'database name'})
}

module.exports = CreateClassCommand
