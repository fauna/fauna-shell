const {Command, flags} = require('@oclif/command')

const faunadb = require('faunadb');
const q = faunadb.query;
const os = require('os');
const path = require('path');
const fs = require('fs')

function getConfigFile() {
	return path.join(os.homedir(), '.fauna-shell');
}

function getRootKey(fileName) {
	return new Promise(function(resolve, reject){
		fs.readFile(fileName, 'utf8', (err, data) => {
			err ? reject(err) : resolve(data);
		});
	});
}

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
