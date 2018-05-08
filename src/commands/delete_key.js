const {Command, flags} = require('@oclif/command')

const {getRootKey, getConfigFile} = require('../lib/misc.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class DeleteKeyCommand extends Command {
  async run() {
	  const {flags} = this.parse(DeleteKeyCommand);
	  const key = flags.key || 'default';
	  const log = this.log;
	  
	  getRootKey(getConfigFile())
	  .then(function(rootKey) {
		  log(`deleting key ${key}`);
		  var client = new faunadb.Client({ secret: rootKey });
		  client.query(q.Delete(q.Ref(q.Keys(null), key)))
		  .then(function(res) {
			  log(res);
		  })
		  .catch(function(error) {
			  log(error);
		  });
	  })
	  .catch(function(error) {
		  log(error);
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
