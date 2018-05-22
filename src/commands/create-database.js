const FaunaCommand = require('../lib/fauna_command.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class CreateDatabaseCommand extends FaunaCommand {
  async run() {
		const {args} = this.parse(CreateDatabaseCommand);
	  const name = args.name || 'default';
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
Creates a database
`

CreateDatabaseCommand.examples = [
	'$ fauna-shell create-database [DBNAME]'
]

CreateDatabaseCommand.args = [
	{name: 'dbname'},
]

module.exports = CreateDatabaseCommand
