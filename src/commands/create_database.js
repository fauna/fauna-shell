const {Command, flags} = require('@oclif/command')

const {getRootKey, getConfigFile} = require('../lib/misc.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class CreateDatabaseCommand extends Command {
  async run() {
	  const {flags} = this.parse(CreateDatabaseCommand);
	  const name = flags.name || 'default';
	  const log = this.log;
	  
	  getRootKey(getConfigFile())
	  .then(function(rootKey) {
		  log(`creating database ${name}`);
		  var client = new faunadb.Client({ secret: rootKey });
		  client.query(q.CreateDatabase({ name: name }))
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

CreateDatabaseCommand.description = `
Describe the command here
...
Extra documentation goes here
`

CreateDatabaseCommand.flags = {
  name: flags.string({char: 'n', description: 'database name'}),
}

module.exports = CreateDatabaseCommand
