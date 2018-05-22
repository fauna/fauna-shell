const FaunaCommand = require('../lib/fauna_command.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class CreateDatabaseCommand extends FaunaCommand {
  async run() {
		const {args} = this.parse(CreateDatabaseCommand);	
	  const dbname = args.dbname; 
	  const log = this.log;
	  
		this.withClient(function(client) {
		  log(`creating database ${dbname}`);
		  client.query(q.CreateDatabase({ name: dbname }))
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
Creates a database
`

CreateDatabaseCommand.examples = [
	'$ fauna-shell create-database dbname'
]

CreateDatabaseCommand.args = [
	{
		name: 'dbname', 
		required: true,
		description: 'database name'
	},
]

module.exports = CreateDatabaseCommand
