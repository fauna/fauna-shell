const {Command, flags} = require('@oclif/command')
const FaunaCommand = require('../lib/fauna_command.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class DeleteKeyCommand extends FaunaCommand {
  async run() {
	  const {flags} = this.parse(DeleteKeyCommand);
	  const key = flags.key || 'default';
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
Describe the command here
...
Extra documentation goes here
`

DeleteKeyCommand.flags = {
  key: flags.string({char: 'k', description: 'key name'}),
}

module.exports = DeleteKeyCommand
