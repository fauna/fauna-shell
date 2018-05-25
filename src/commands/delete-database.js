const FaunaCommand = require('../lib/fauna_command.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class DeleteDatabaseCommand extends FaunaCommand {
  async run() {
	  const {args} = this.parse(DeleteDatabaseCommand);
	  const dbname = args.dbname;
		this.query(
			q.Delete(q.Database(dbname)), 
			`deleting database ${dbname}`
		);
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
