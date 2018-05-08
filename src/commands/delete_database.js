const {Command, flags} = require('@oclif/command')

const {getRootKey, getConfigFile} = require('../lib/misc.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class DeleteDatabaseCommand extends Command {
  async run() {
	  const {flags} = this.parse(DeleteDatabaseCommand);
	  const name = flags.name || 'default';
	  const log = this.log;
	  
	  getRootKey(getConfigFile())
	  .then(function(rootKey) {
		  log(`deleting database ${name}`);
		  var client = new faunadb.Client({ secret: rootKey });
		  client.query(q.Delete(q.Database(name)))
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

DeleteDatabaseCommand.description = `
Describe the command here
...
Extra documentation goes here
`

DeleteDatabaseCommand.flags = {
  name: flags.string({char: 'n', description: 'database name'}),
}

module.exports = DeleteDatabaseCommand
