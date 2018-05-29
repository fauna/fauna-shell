const FaunaCommand = require('../lib/fauna_command.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class CreateDatabaseCommand extends FaunaCommand {
  async run() {
	  const dbname = this.args.dbname; 
		this.query(
			q.CreateDatabase({ name: dbname }), 
			`creating database ${dbname}`
		);
  }
}

CreateDatabaseCommand.description = `
Creates a database
`

CreateDatabaseCommand.examples = [
	'$ fauna-shell create-database dbname'
]

CreateDatabaseCommand.flags = {
	...FaunaCommand.flags
}

CreateDatabaseCommand.args = [
	{
		name: 'dbname', 
		required: true,
		description: 'database name'
	},
]

module.exports = CreateDatabaseCommand
