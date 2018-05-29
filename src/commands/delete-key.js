const FaunaCommand = require('../lib/fauna_command.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class DeleteKeyCommand extends FaunaCommand {
  async run() {
	  const keyname = this.args.keyname;
	  const log = this.log;
		this.query(
			q.Delete(q.Ref(q.Keys(null), keyname)),
			`deleting key ${keyname}`
		);
  }
}

DeleteKeyCommand.description = `
Deletes a key
`

DeleteKeyCommand.examples = [
	'$ fauna-shell delete-key 123456789012345678'
]

DeleteKeyCommand.flags = {
	...FaunaCommand.flags
}

DeleteKeyCommand.args = [
	{
		name: 'keyname', 
		required: true, 
		description: 'key name'
	},
]

module.exports = DeleteKeyCommand
