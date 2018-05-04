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

class CreateClassCommand extends Command {
  async run() {
	  const {flags} = this.parse(CreateClassCommand);
	  const name = flags.name || 'default';
		const database = flags.database || '';
	  const log = this.log;
	  
	  getRootKey(getConfigFile())
	  .then(function(rootKey) {
		  log(`creating database ${name}`);
	 	  var client = new faunadb.Client({ secret: "fnACuZ8SV1ACAul5EGuawxCgeVdOn8SdXYKiMPUZ" + ":" + database + ":admin" });
		  client.query(q.CreateClass({ name: name }))
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

CreateClassCommand.description = `
Describe the command here
...
Extra documentation goes here
`

CreateClassCommand.flags = {
  name: flags.string({char: 'n', description: 'class name'}),
  database: flags.string({char: 'd', description: 'database name'})
}

module.exports = CreateClassCommand
