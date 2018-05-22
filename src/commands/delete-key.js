const FaunaCommand = require('../lib/fauna_command.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class DeleteKeyCommand extends FaunaCommand {
  async run() {
	  const {args} = this.parse(DeleteKeyCommand);
	  const key = args.key || 'default';
	  const log = this.log;
	  
		this.withClient(function(client) {
		  log(`deleting key ${key}`);
		  client.query(q.Delete(q.Ref(q.Keys(null), key)))
		  .then(function(res) {
			  log(res);
		  })
		  .catch(function(error) {
			  log(error);
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
