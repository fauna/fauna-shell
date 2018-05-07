const {Command, flags} = require('@oclif/command')

const {getRootKey, getConfigFile} = require('../lib/misc.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class ListKeysCommand extends Command {
	async run() {
		const {flags} = this.parse(ListKeysCommand);
		const name = flags.name || 'default';
		const log = this.log;
		getRootKey(getConfigFile())
		.then(function (rootKey) {
			log(rootKey);
			var client = new faunadb.Client({ secret: rootKey });
	  
			var helper = client.paginate(q.Keys(null));
			helper.each(function(page) {
				log(page);
			});
		})
	  .catch(function(error) {
		  log(error);
	  })
	}
}

ListKeysCommand.description = `
Describe the command here
...
Extra documentation goes here
`

module.exports = ListKeysCommand
