const FaunaCommand = require('../lib/fauna_command.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class DeleteKeyCommand extends FaunaCommand {
  async run() {
	  const {args} = this.parse(DeleteKeyCommand);
	  const keyname = args.keyname;
	  const log = this.log;
	  
		this.withClient(function(client) {
		  log(`deleting key ${keyname}`);
		  client.query(q.Delete(q.Ref(q.Keys(null), keyname)))
		  .then(function(res) {
			  log(res);
		  })
		  .catch(function(error) {
			  log("Error:", error.message);
		  });
		});
  }
}

DeleteKeyCommand.description = `
Deletes a key
`

DeleteKeyCommand.examples = [
	'$ fauna-shell delete-key 123456789012345678'
]

DeleteKeyCommand.args = [
	{
		name: 'keyname', 
		required: true, 
		description: 'key name'
	},
]

module.exports = DeleteKeyCommand
