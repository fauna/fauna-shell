const {Command, flags} = require('@oclif/command')

const faunadb = require('faunadb');
const q = faunadb.query;
const os = require('os');
const path = require('path');
const fs = require('fs')

function getRootKey() {
	return "fnACuZ8SV1ACAul5EGuawxCgeVdOn8SdXYKiMPUZ";
	var configFile = path.join(os.homedir(), '.fauna-shell');
	fs.readFile(configFile, 'utf8', function (err, data) {
	  if (err) {
	    return console.log(err);
	  }
	  return data;
	});
}

class ListKeysCommand extends Command {
  async run() {
	  const {flags} = this.parse(ListKeysCommand);
	  const name = flags.name || 'default';
	  const rootKey = getRootKey();
	  this.log(rootKey);
	  const log = this.log;
	  var client = new faunadb.Client({ secret: rootKey });
	  
	  var helper = client.paginate(q.Keys(null));
	  helper.each(function(page) {
		  log(page);
	  });
  }
}

ListKeysCommand.description = `
Describe the command here
...
Extra documentation goes here
`

module.exports = ListKeysCommand
