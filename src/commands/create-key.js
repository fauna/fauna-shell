const FaunaCommand = require('../lib/fauna_command.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class CreateKeyCommand extends FaunaCommand {
  async run() {
		const {args} = this.parse(CreateKeyCommand);
	  const dbname = args.dbname;
		const role = args.role;
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

CreateKeyCommand.description = `
Creates a key for the specified database
`

CreateKeyCommand.examples = [
	'$ fauna-shell create-key dbname admin'
]

CreateKeyCommand.args = [
	{
		name: 'dbname', 
		required: true, 
		description: 'database name'
	},
	{
		name: 'role',
		description: 'key user role',
		default: 'admin',
		options: ['admin', 'server', 'server-readonly', 'client']
	}
]

module.exports = CreateKeyCommand