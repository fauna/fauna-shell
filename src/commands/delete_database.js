const {Command, flags} = require('@oclif/command')
const FaunaCommand = require('../lib/fauna_command.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class DeleteDatabaseCommand extends FaunaCommand {
  async run() {
	  const {flags} = this.parse(DeleteDatabaseCommand);
	  const name = flags.name || 'default';
	  const log = this.log;
		
	  this.withClient(function(client) {
		  log(`deleting database ${name}`);
		  client.query(q.Delete(q.Database(name)))
		  .then(function(res) {
			  log(res);
		  })
		  .catch(function(error) {
			  log(error);
		  });
		});
  }
}

DeleteDatabaseCommand.description = `
Describe the command here
...
Extra documentation goes here
`

DeleteDatabaseCommand.flags = {
  name: flags.string({char: 'n', description: 'database name'}),
}

module.exports = DeleteDatabaseCommand
