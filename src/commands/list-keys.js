const {flags} = require('@oclif/command')
const FaunaCommand = require('../lib/fauna_command.js')
const faunadb = require('faunadb');
const q = faunadb.query;

class ListKeysCommand extends FaunaCommand {
	async run() {
		const log = this.log;
		
		this.withClient(function(client) {
			log('listing keys')
			var helper = client.paginate(q.Keys(null));
			helper.each(function(page) {
				log(page);
			});
		});
	}
}

ListKeysCommand.description = `
Lists top level keys
`

ListKeysCommand.examples = [
	'$ fauna-shell list-keys'
]

module.exports = ListKeysCommand
