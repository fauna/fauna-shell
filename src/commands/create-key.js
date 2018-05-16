const {flags} = require('@oclif/command')
const FaunaCommand = require('../lib/fauna_command.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class CreateDatabaseCommand extends FaunaCommand {
  async run() {
		const {args} = this.parse(CreateDatabaseCommand);
	  const dbname = args.dbname || 'default';
		const role = args.role || 'admin';
	  const log = this.log;
	  
		this.withClient(function(client) {
		  log(`creating key for database ${dbname} with role ${role}`);
			client.query(
			  q.CreateKey(
			    { database: q.Database(dbname), role: role }))
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
Creates a key for the specified database
`

CreateDatabaseCommand.examples = [
	'$ fauna-shell create-key [DBNAME] [ROLE]'
]

CreateDatabaseCommand.args = [
	{name: 'dbname'},
	{role: 'role'}
]

module.exports = CreateDatabaseCommand
