const {flags} = require('@oclif/command')
const FaunaCommand = require('../lib/fauna_command.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class DeleteDatabaseCommand extends FaunaCommand {
  async run() {
	  const {args} = this.parse(DeleteDatabaseCommand);
	  const name = args.name || 'default';
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
Deletes a database
`

DeleteDatabaseCommand.examples = [
	'$ fauna-shell delete-database [DBNAME]'
]

DeleteDatabaseCommand.args = [
	{name: 'dbname'},
]

module.exports = DeleteDatabaseCommand
