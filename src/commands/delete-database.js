const FaunaCommand = require('../lib/fauna_command.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class DeleteDatabaseCommand extends FaunaCommand {
  async run() {
	  const {args} = this.parse(DeleteDatabaseCommand);
	  const dbname = args.dbname;
	  const log = this.log;
		
	  this.withClient(function(client) {
		  log(`deleting database ${dbname}`);
		  client.query(q.Delete(q.Database(dbname)))
		  .then(function(res) {
			  log(res);
		  })
		  .catch(function(error) {
			  log("Error:", error.message);
		  });
		});
  }
}

DeleteDatabaseCommand.description = `
Deletes a database
`

DeleteDatabaseCommand.examples = [
	'$ fauna-shell delete-database dbname'
]

DeleteDatabaseCommand.args = [
	{
		name: 'dbname', 
		required: true, 
		description: 'database name'
	},
]

module.exports = DeleteDatabaseCommand
